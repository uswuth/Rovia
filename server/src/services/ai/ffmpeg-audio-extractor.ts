import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/apiError.js';
import { downloadObjectToFile } from '../storage.service.js';
import { AudioExtractionInput, AudioExtractionResult, AudioExtractor } from '../../types/index.js';

/**
 * FFmpeg adapter for AudioExtractor.
 *
 * Reads the authoritative recording out of object storage into a temp file,
 * then remuxes to 16 kHz mono PCM WAV, which is what Whisper expects. The
 * original WebM is never modified and the WAV is temporary by design.
 */

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
    // The source extension comes from the validated MIME type, never from the client.
    const sourcePath = path.join(workDir, `source${input.recordingMimeType.includes('mp4') ? '.mp4' : '.webm'}`);
    const audioPath = path.join(workDir, 'audio.wav');

    try {
      await downloadObjectToFile(input.storageKey, sourcePath);

      await runFfmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', sourcePath,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-acodec', 'pcm_s16le',
        '-f', 'wav',
        audioPath
      ]);

      const stats = await fs.stat(audioPath);
      if (stats.size <= 44) {
        // A valid WAV header is 44 bytes; anything smaller has no audio track.
        throw new ApiError(500, 'Recording contains no decodable audio track');
      }

      const durationMs = await this.probeDurationMs(audioPath);
      logger.info(`Audio extracted for recording ${input.recordingId}: ${stats.size} bytes, ${durationMs}ms`);

      return { filePath: audioPath, durationMs };
    } catch (error) {
      await fs.rm(workDir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Duration from the WAV header, so the extractor does not need a second
   * ffprobe process. Returns null when it cannot be determined.
   */
  private async probeDurationMs(filePath: string): Promise<number | null> {
    try {
      const handle = await fs.open(filePath, 'r');
      try {
        const header = Buffer.alloc(44);
        await handle.read(header, 0, 44, 0);
        // RIFF chunk size at byte 4 is the file length minus 8.
        const byteRate = header.readUInt32LE(28);
        if (!byteRate) return null;
        const dataSize = header.readUInt32LE(40);
        return Math.round((dataSize / byteRate) * 1000);
      } finally {
        await handle.close();
      }
    } catch (error) {
      logger.warn(`Could not read WAV duration: ${(error as Error).message}`);
      return null;
    }
  }
}
