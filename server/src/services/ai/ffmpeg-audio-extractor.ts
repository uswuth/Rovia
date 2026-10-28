import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/apiError.js';
import { downloadObjectToFile } from '../storage.service.js';
import { AudioExtractionInput, AudioExtractionResult, AudioExtractor } from '../../types/index.js';

/** FFmpeg adapter for AudioExtractor. Reads the authoritative recording out of object storage into a temp file, then produces the chunks the transcriber will upload. Three steps happen in one pass: 1. Remux to 16 kHz mono, which is what Whisper expects. 2. Drop silence. Meetings are mostly dead air between sentences, and a hour-long recording is mostly dead air. Removing it cuts both the bytes uploaded and the words Whisper hallucinates over quiet audio. 3. Encode lossless FLAC (roughly half the size of PCM at no quality cost) and split into chunks, because the transcription API caps a single upload at 25 MB and an hour of meeting audio is far larger than that. The original WebM is never modified. Every artefact here is temporary and is deleted by the caller. */

/** Comfortably under the provider's 25 MB per-file ceiling. */
const CHUNK_SECONDS = 600;

/** Whisper drifts on silence and invents text to fill it. */
const SILENCE_THRESHOLD_DB = -50;
const SILENCE_MIN_DURATION_SECONDS = 1.5;

/** ffmpeg selects its demuxer from the file extension, so the temporary copy has to carry the right one. The meeting recorder captures audio-only, but a video recording is still accepted for any caller that uses one. */
const sourceExtensionFor = (mimeType: string): string => {
  const normalised = mimeType.trim().toLowerCase();
  if (normalised.startsWith('audio/ogg')) return '.ogg';
  if (normalised.startsWith('video/mp4')) return '.mp4';
  return '.webm';
};

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (error) => reject(new ApiError(500, `FFmpeg could not be started: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new ApiError(500, `FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });

export class FfmpegAudioExtractor implements AudioExtractor {
  async extract(input: AudioExtractionInput): Promise<AudioExtractionResult> {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intellmeet-audio-'));
    // The source extension comes from the validated MIME type, never from the
    // client, because ffmpeg picks its demuxer from the file extension.
    const sourcePath = path.join(workDir, `source${sourceExtensionFor(input.recordingMimeType)}`);
    const chunkPattern = path.join(workDir, 'chunk-%04d.flac');

    try {
      await downloadObjectToFile(input.storageKey, sourcePath);

      // stop_periods=-1 removes every internal silence longer than the minimum,
      // not just the leading and trailing ones. detection=rms measures loudness
      // rather than sample peaks, so a quiet-but-present speaker is not clipped.
      await runFfmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', sourcePath,
        '-vn',
        '-af',
        [
          'silenceremove=start_periods=1',
          `:start_duration=${SILENCE_MIN_DURATION_SECONDS}`,
          `:start_threshold=${SILENCE_THRESHOLD_DB}dB`,
          ':stop_periods=-1',
          `:stop_duration=${SILENCE_MIN_DURATION_SECONDS}`,
          `:stop_threshold=${SILENCE_THRESHOLD_DB}dB`,
          ':detection=rms',
        ].join(''),
        '-ac', '1',
        '-ar', '16000',
        '-acodec', 'flac',
        // segment muxer writes chunk-0000.flac, chunk-0001.flac, ...
        '-f', 'segment',
        '-segment_time', String(CHUNK_SECONDS),
        '-reset_timestamps', '1',
        chunkPattern
      ]);

      const chunkPaths = (await fs.readdir(workDir))
        .filter((name) => name.startsWith('chunk-') && name.endsWith('.flac'))
        .sort()
        .map((name) => path.join(workDir, name));

      if (chunkPaths.length === 0) {
        throw new ApiError(500, 'Recording contains no decodable audio track');
      }

      let totalBytes = 0;
      let totalDurationMs = 0;
      for (const chunkPath of chunkPaths) {
        const stats = await fs.stat(chunkPath);
        totalBytes += stats.size;
        totalDurationMs += (await this.probeFlacDurationMs(chunkPath)) ?? 0;
      }

      logger.info(
        `Audio prepared for recording ${input.recordingId}: ${chunkPaths.length} chunk(s), ` +
          `${Math.round(totalBytes / 1024)} KB, ~${Math.round(totalDurationMs / 1000)}s after silence removal`
      );

      return { filePaths: chunkPaths, durationMs: totalDurationMs || null };
    } catch (error) {
      await fs.rm(workDir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * FLAC stores its sample rate and total samples in the STREAMINFO block at a
   * fixed offset, so duration needs no second ffprobe process. Returns null
   * when the header cannot be read rather than guessing.
   */
  private async probeFlacDurationMs(filePath: string): Promise<number | null> {
    try {
      const handle = await fs.open(filePath, 'r');
      try {
        // 4 bytes magic "fLaC", 4 bytes metadata block header, then STREAMINFO:
        // 2 bytes min block, 2 max block, 3 min frame, 3 max frame, then 8 bytes
        // packing sampleRate (20 bits) and channels (3) and bits (5) and total samples (36).
        const header = Buffer.alloc(42);
        const { bytesRead } = await handle.read(header, 0, 42, 0);
        if (bytesRead < 42) return null;
        if (header.toString('ascii', 0, 4) !== 'fLaC') return null;

        const info = header.subarray(8);
        const sampleRate = (info[10] << 12) | (info[11] << 4) | (info[12] >> 4);
        if (!sampleRate) return null;

        // The 36-bit total sample count spans the last 5 bytes of this field.
        const totalSamples =
          (info[13] & 0x0f) * 2 ** 32 + info[14] * 2 ** 24 + info[15] * 2 ** 16 + info[16] * 2 ** 8 + info[17];
        return Math.round((totalSamples / sampleRate) * 1000);
      } finally {
        await handle.close();
      }
    } catch (error) {
      logger.warn(`Could not read FLAC duration: ${(error as Error).message}`);
      return null;
    }
  }
}