import fs from 'node:fs/promises';
import path from 'node:path';
import { Recording } from '../models/recording.model.js';
import { logger } from '../utils/logger.js';
import { requireOrganizationId } from '../utils/scope.js';
import { assertObjectId } from '../utils/objectId.js';
import { AudioExtractor, Summarizer, Transcriber, TranscriptionSegment } from '../types/index.js';

/** One participant's contribution to a meeting, as stored on the transcript. */
interface TranscriptSpeaker {
  speakerId: string;
  speakerName: string;
  speakerText: string;
  speakerDurationMs: number;
  spoke: boolean;
}
import { FfmpegAudioExtractor } from './ai/ffmpeg-audio-extractor.js';
import { GroqTranscriber } from './ai/groq-transcriber.js';
import { OpenRouterSummarizer } from './ai/openrouter-summarizer.js';
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

/** Orchestrates the AI pipeline. It contains no FFmpeg, transcription or summarisation logic: those live behind the three injected interfaces, so the Recording domain can be tested with fakes and any provider can be swapped. Transcription runs on Groq (whisper-large-v3) and summarisation on the OpenRouter free tier. Both are hosted, so no model weights are downloaded to this host and no AI container is required. Failure policy: a failed stage marks its OWN record FAILED. The recording stays READY, and a later stage failure never invalidates an earlier success, so summarisation can be retried without retranscribing. Today this runs inline from complete(). Replacing that call with an enqueue is the only change needed to move to a worker. */
export class RecordingPostProcessingService {
  constructor(
    private readonly audioExtractor: AudioExtractor = new FfmpegAudioExtractor(),
    private readonly transcriber: Transcriber = new GroqTranscriber(),
    private readonly summarizer: Summarizer = new OpenRouterSummarizer()
  ) {}

  async runPostProcessing(
    recordingId: string,
    organizationId: string,
    userId: string,
    aiSummaryEnabled = false
  ): Promise<void> {
    requireOrganizationId(organizationId, 'process a recording');
    assertObjectId(recordingId, 'recordingId');

    const recording = await Recording.findOne({ _id: recordingId, organization_id: organizationId });
    if (!recording) {
      logger.warn(`Post-processing skipped: recording ${recordingId} not found`);
      return;
    }

    const transcript = await this.transcribe(recording, organizationId);
    if (!transcript) return;

    // Transcription (speech-to-text) always runs — it is the raw record of what
    // was said. Summarisation is only produced when the caller explicitly asked
    // for it (the "AI Summary" checkbox in the record modal).
    if (!aiSummaryEnabled) return;

    // A meeting where nobody spoke has nothing to summarise.
    if (!transcript.hasText) {
      logger.info(`Skipping summarisation for recording ${recordingId}: transcript has no speech`);
      return;
    }

    await this.summarize(transcript.transcriptId, recordingId, organizationId, userId);
  }

  /**
   * Transcribes every speaker track independently, then stores one transcript
   * holding each person's words separately.
   *
   * Tracks are never mixed: simultaneous speech is what garbles a transcript,
   * so each participant's audio is sent to the model on its own.
   *
   * A track that fails does not sink the whole recording. A participant who
   * never spoke, or whose track was unreadable, is recorded as silent and the
   * rest of the meeting still produces a summary. A meeting in which nobody
   * spoke at all is a valid READY transcript with no text, not a failure.
   */
  private async transcribe(
    recording: {
      _id: unknown;
      recording_mime_type: string;
      recording_speakers: Array<{
        speakerId: string;
        speakerName: string;
        speakerIndex: number;
        storageKey: string;
        mimeType: string;
      }>;
    },
    organizationId: string
  ): Promise<{ transcriptId: string; hasText: boolean } | null> {
    const recordingId = String((recording as { _id: { toString(): string } })._id);
    const transcript = await startTranscriptService(recordingId, organizationId);
    const speakers = recording.recording_speakers ?? [];

    if (speakers.length === 0) {
      logger.warn(`Recording ${recordingId} has no speaker tracks; nothing to transcribe`);
      await failTranscriptService(transcript.transcriptId, organizationId).catch(() => undefined);
      return null;
    }

    const results: TranscriptSpeaker[] = [];
    let combinedText = '';
    let totalDurationMs = 0;
    let anySucceeded = false;
    let failedTracks = 0;

    for (const speaker of speakers) {
      // The raw speakerId is a database id and must never reach a reader.
      const displayName = speaker.speakerName || `Speaker ${speaker.speakerIndex + 1}`;
      let workDir: string | null = null;
      try {
        const extracted = await this.audioExtractor.extract({
          storageKey: speaker.storageKey,
          recordingMimeType: speaker.mimeType,
          recordingId,
          label: displayName
        });
        workDir = extracted.filePaths.length > 0 ? path.dirname(extracted.filePaths[0]) : null;

        if (extracted.filePaths.length === 0) {
          // The extractor already deleted its temp directory. Nothing above the
          // silence threshold means this participant simply never spoke.
          results.push({
            speakerId: speaker.speakerId,
            speakerName: displayName,
            speakerText: '',
            speakerDurationMs: 0,
            spoke: false
          });
          logger.info(`No speech above the threshold for ${displayName} on recording ${recordingId}`);
          continue;
        }

        // The extractor always emits FLAC chunks, so that is the type to declare.
        const result = await this.transcribeChunks(extracted.filePaths, recordingId, displayName, 'audio/flac');
        totalDurationMs += result.durationMs ?? 0;
        results.push({
          speakerId: speaker.speakerId,
          speakerName: displayName,
          speakerText: result.text,
          speakerDurationMs: result.durationMs ?? 0,
          spoke: result.text.length > 0
        });
        if (result.text) {
          anySucceeded = true;
          // The flat text is kept for search and the copy-to-clipboard button.
          combinedText += combinedText ? `\n\n${displayName}: ${result.text}` : result.text;
        }
        logger.info(`Transcribed ${displayName} for recording ${recordingId} (${result.text.length} chars)`);
      } catch (error) {
        // One unreadable track must not discard everyone's speech.
        failedTracks += 1;
        logger.error(`Transcription failed for ${displayName} on recording ${recordingId}: ${(error as Error).message}`);
        results.push({
          speakerId: speaker.speakerId,
          speakerName: displayName,
          speakerText: '',
          speakerDurationMs: 0,
          spoke: false
        });
      } finally {
        // Temporary audio is removed whether or not transcription succeeded. The
        // stored track in object storage is untouched.
        if (workDir) {
          await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    }

    if (!anySucceeded) {
      if (failedTracks === speakers.length) {
        logger.error(`Every speaker track failed for recording ${recordingId}`);
        await failTranscriptService(transcript.transcriptId, organizationId).catch(() => undefined);
        return null;
      }

      // Every track was readable but silent. That is a valid outcome: complete
      // the transcript so the client stops waiting, and leave summarisation out.
      const empty = await completeTranscriptService(transcript.transcriptId, organizationId, {
        text: '',
        language: null,
        durationMs: totalDurationMs || null,
        segments: [],
        speakers: results
      });
      logger.info(
        `Transcript READY with no speech for recording ${recordingId} ` +
          `(${results.length} track(s), ${failedTracks} unreadable)`
      );
      return { transcriptId: empty.transcriptId, hasText: false };
    }

    const ready = await completeTranscriptService(transcript.transcriptId, organizationId, {
      text: combinedText.trim(),
      language: null,
      durationMs: totalDurationMs || null,
      segments: [],
      speakers: results
    });
    logger.info(
      `Transcript READY for recording ${recordingId}: ${results.length} speaker(s), ${combinedText.length} chars`
    );
    return { transcriptId: ready.transcriptId, hasText: true };
  }

  /**
   * Transcribes each chunk in order and joins the results into one speaker's text.
   *
   * Segments are kept in the flattened order the chunks arrive, with each
   * chunk's own timings preserved, so the stored transcript still reads
   * chronologically even though the timestamps restart per request.
   */
  private async transcribeChunks(
    filePaths: string[],
    recordingId: string,
    label: string,
    mimeType: string
  ): Promise<{ text: string; language: string | null; durationMs: number | null; segments: TranscriptionSegment[] }> {
    const texts: string[] = [];
    const segments: TranscriptionSegment[] = [];
    let language: string | null = null;
    let durationMs = 0;

    for (const [index, filePath] of filePaths.entries()) {
      const chunk = await this.transcriber.transcribe({ filePath, mimeType });
      if (chunk.text) {
        texts.push(chunk.text);
      }
      segments.push(...chunk.segments);
      if (!language && chunk.language) {
        language = chunk.language;
      }
      durationMs += chunk.durationMs ?? 0;
      logger.info(
        `Transcribed ${label} chunk ${index + 1}/${filePaths.length} for recording ${recordingId} ` +
          `(${chunk.text.length} chars)`
      );
    }

    return { text: texts.join(' '), language, durationMs: durationMs || null, segments };
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

      const text = (transcript.transcript_text ?? '').trim();
      if (!text) {
        await completeSummaryService(summary.summaryId, organizationId, {
          summary: 'No speech was detected in this recording.',
          keyPoints: [],
          actionItems: []
        });
        logger.info(`Summary READY (empty) for recording ${recordingId}`);
        return;
      }

      // The flat text already carries "Name: ..." per turn, so the model can see who
      // committed to what and attribute action items without inventing owners.
      const result = await this.summarizer.summarize({ transcript: text });
      await completeSummaryService(summary.summaryId, organizationId, result);
      logger.info(`Summary READY for recording ${recordingId}`);
    } catch (error) {
      logger.error(`Summarisation failed for recording ${recordingId}: ${(error as Error).message}`);
      await failSummaryService(summary.summaryId, organizationId).catch(() => undefined);
    }
  }
}

export const recordingPostProcessingService = new RecordingPostProcessingService();