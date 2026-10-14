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
 * Groq adapter for Transcriber.
 *
 * Speaks the same OpenAI-compatible /v1/audio/transcriptions shape as the
 * original local Whisper adapter, so the Recording domain is unchanged: only
 * this class swaps. Groq hosts whisper-large-v3 on a free tier, so no model is
 * downloaded or run on the developer's machine.
 *
 * A meeting is longer than the provider's 25 MB per-file limit, so audio
 * arrives as chunks. Each is transcribed independently and the text is joined
 * in order. Whisper carries no context between requests, so a sentence split
 * across a chunk boundary can lose a word; the extractor keeps chunks large
 * enough that this affects at most the last line of each one.
 *
 * Audio leaves the server to reach Groq. That is a deliberate trade-off against
 * the local adapter and must be stated wherever transcripts are exposed.
 */

interface GroqSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface GroqResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: GroqSegment[];
}

export class GroqTranscriber implements Transcriber {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, 'Transcription provider is not configured');
    }

    const baseUrl = (env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');

    let audio: Buffer;
    try {
      audio = await fs.readFile(input.filePath);
    } catch (error) {
      throw new ApiError(500, `Could not read extracted audio: ${(error as Error).message}`);
    }

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/flac' }), path.basename(input.filePath));
    form.append('model', env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3');
    form.append('response_format', 'verbose_json');
    // Greedy decoding. Summaries of the same recording must not change between
    // runs, and a non-zero temperature lets Whisper sample and diverge.
    form.append('temperature', '0');
    // Omitted entirely for automatic detection; the product must not force English.
    if (input.language) {
      form.append('language', input.language);
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: timeoutSignal(env.GROQ_TIMEOUT_MS ?? 600000)
      });
    } catch (error) {
      throw new ApiError(503, `Transcription provider is unavailable: ${(error as Error).message}`);
    }

    if (!response.ok) {
      // Logged for operators, never returned to the client: the body can echo
      // account detail and must not reach the UI.
      const detail = await response.text().catch(() => '');
      logger.error(`Groq transcription returned ${response.status}: ${detail.slice(0, 300)}`);
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(502, 'Transcription provider rejected the configured credentials');
      }
      if (response.status === 429) {
        throw new ApiError(429, 'Transcription provider rate limit reached, please retry shortly');
      }
      throw new ApiError(502, 'Transcription provider failed');
    }

    const payload = (await response.json()) as GroqResponse;

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