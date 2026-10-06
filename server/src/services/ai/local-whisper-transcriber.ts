import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/apiError.js';
import { timeoutSignal } from '../../utils/ai.js';
import {
  TranscriptionInput,
  TranscriptionResult,
  TranscriptionSegment,
  Transcriber
} from '../../types/index.js';

/**
 * Local Whisper adapter for Transcriber.
 *
 * Speaks the OpenAI-compatible /v1/audio/transcriptions shape to a Whisper
 * server running on the developer machine or inside Compose. No API key is
 * involved: the base URL points at localhost or a Compose service.
 */

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
}

export class LocalWhisperTranscriber implements Transcriber {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const baseUrl = (env.WHISPER_BASE_URL || 'http://whisper:9000').replace(/\/$/, '');

    let audio: Buffer;
    try {
      audio = await fs.readFile(input.filePath);
    } catch (error) {
      throw new ApiError(500, `Could not read extracted audio: ${(error as Error).message}`);
    }

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), path.basename(input.filePath));
    form.append('response_format', 'verbose_json');
    if (env.WHISPER_MODEL) {
      form.append('model', env.WHISPER_MODEL);
    }
    // Omitted entirely for automatic detection; the product must not force English.
    if (input.language) {
      form.append('language', input.language);
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        body: form,
        signal: timeoutSignal(env.WHISPER_TIMEOUT_MS ?? 300000)
      });
    } catch (error) {
      throw new ApiError(503, `Local transcription service is unavailable: ${(error as Error).message}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error(`Whisper returned ${response.status}: ${detail.slice(0, 300)}`);
      throw new ApiError(502, 'Local transcription service failed');
    }

    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      segments?: WhisperSegment[];
    };

    const segments: TranscriptionSegment[] = (payload.segments ?? [])
      .filter((segment) => typeof segment.text === 'string')
      .map((segment) => ({
        startMs: Math.round((segment.start ?? 0) * 1000),
        endMs: Math.round((segment.end ?? 0) * 1000),
        text: (segment.text ?? '').trim()
      }));

    return {
      text: (payload.text ?? '').trim(),
      language: payload.language ?? null,
      durationMs: typeof payload.duration === 'number' ? Math.round(payload.duration * 1000) : null,
      segments
    };
  }
}
