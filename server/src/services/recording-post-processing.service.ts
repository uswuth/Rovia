import fs from 'node:fs/promises';
import path from 'node:path';
import { Recording } from '../models/recording.model.js';
import { logger } from '../utils/logger.js';
import { requireOrganizationId } from '../utils/scope.js';
import { assertObjectId } from '../utils/objectId.js';
import { AudioExtractor, Summarizer, Transcriber } from '../types/index.js';
import { FfmpegAudioExtractor } from './ai/ffmpeg-audio-extractor.js';
import { LocalWhisperTranscriber } from './ai/local-whisper-transcriber.js';
import { OllamaSummarizer } from './ai/ollama-summarizer.js';
import {
  startTranscriptService,
  completeTranscriptService,
  failTranscriptService
} from './transcript.service.js';
import {
  startSummaryService,
  completeSummaryService,
  failSummaryService
} from './summary.service.js';

/**
 * Orchestrates the local AI pipeline. It contains no FFmpeg, Whisper or Ollama
 * logic: those live behind the three injected interfaces, so the Recording
 * domain can be tested with fakes and any provider can be swapped later.
 *
 * Failure policy: a failed stage marks its OWN record FAILED. The recording
 * stays READY, and a later stage failure never invalidates an earlier success,
 * so summarisation can be retried without retranscribing.
 *
 * Today this runs inline from complete(). Replacing that call with an enqueue
 * is the only change needed to move to a worker.
 */
export class RecordingPostProcessingService {
  constructor(
    private readonly audioExtractor: AudioExtractor = new FfmpegAudioExtractor(),
    private readonly transcriber: Transcriber = new LocalWhisperTranscriber(),
    private readonly summarizer: Summarizer = new OllamaSummarizer()
  ) {}

  async runPostProcessing(recordingId: string, organizationId: string, userId: string): Promise<void> {
    requireOrganizationId(organizationId, 'process a recording');
    assertObjectId(recordingId, 'recordingId');

    const recording = await Recording.findOne({ _id: recordingId, organization_id: organizationId });
    if (!recording) {
      logger.warn(`Post-processing skipped: recording ${recordingId} not found`);
      return;
    }

    const transcript = await this.transcribe(recording, organizationId);
    if (!transcript) return;

    await this.summarize(transcript.transcriptId, recordingId, organizationId, userId);
  }

  private async transcribe(
    recording: { _id: unknown; storage_key: string; recording_mime_type: string },
    organizationId: string
  ) {
    const recordingId = String((recording as { _id: { toString(): string } })._id);
    const transcript = await startTranscriptService(recordingId, organizationId);
    let audioFilePath: string | null = null;

    try {
      const extracted = await this.audioExtractor.extract({
        storageKey: recording.storage_key,
        recordingMimeType: recording.recording_mime_type,
        recordingId
      });
      audioFilePath = extracted.filePath;

      const result = await this.transcriber.transcribe({ filePath: extracted.filePath });
      if (!result.text) {
        throw new Error('Transcription produced no text');
      }
      const ready = await completeTranscriptService(transcript.transcriptId, organizationId, result);
      logger.info(`Transcript READY for recording ${recordingId} (${result.text.length} chars)`);
      return ready;
    } catch (error) {
      logger.error(`Transcription failed for recording ${recordingId}: ${(error as Error).message}`);
      await failTranscriptService(transcript.transcriptId, organizationId).catch(() => undefined);
      return null;
    } finally {
      // Temporary audio is removed whether or not transcription succeeded. The
      // original recording in object storage is untouched.
      if (audioFilePath) {
        await fs.rm(path.dirname(audioFilePath), { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  private async summarize(
    transcriptId: string,
    recordingId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    let summary: { summaryId: string };
    try {
      summary = await startSummaryService(transcriptId, recordingId, organizationId, userId);
    } catch (error) {
      logger.error(`Could not start summary for recording ${recordingId}: ${(error as Error).message}`);
      return;
    }

    try {
      const { Transcript } = await import('../models/transcript.model.js');
      const transcript = await Transcript.findOne({ _id: transcriptId, organization_id: organizationId });
      if (!transcript) {
        throw new Error('Transcript disappeared before summarisation');
      }

      const result = await this.summarizer.summarize({ transcript: transcript.transcript_text });
      await completeSummaryService(summary.summaryId, organizationId, result);
      logger.info(`Summary READY for recording ${recordingId}`);
    } catch (error) {
      logger.error(`Summarisation failed for recording ${recordingId}: ${(error as Error).message}`);
      await failSummaryService(summary.summaryId, organizationId).catch(() => undefined);
    }
  }
}

export const recordingPostProcessingService = new RecordingPostProcessingService();
