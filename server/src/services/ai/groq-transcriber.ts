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

/** Groq adapter: audio leaves the server by design, a trade-off to state wherever transcripts are exposed. */

interface GroqSegment {
  start?: number;
  end?: number;
  text?: string;
  /** Probability that the segment holds no speech at all. */
  no_speech_prob?: number;
  /** Mean token log-probability; strongly negative means the model was guessing. */
  avg_logprob?: number;
  /** Text-to-time compression ratio; a decoding loop pushes it far above normal. */
  compression_ratio?: number;
}

interface GroqResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: GroqSegment[];
}

/**
 * Whisper's own confidence signals. Sent together, `no_speech_prob` near 1 and
 * a very negative `avg_logprob` mean the model guessed its way through dead air
 * and wrote something from its training data instead of transcribing speech.
 */
const MAX_NO_SPEECH_PROB = 0.6;
const MIN_AVG_LOGPROB = -1.0;
/** Real speech does not compress this hard; a token loop does. */
const MAX_COMPRESSION_RATIO = 2.4;

/**
 * Text Whisper emits over silence, music or noise. These are memorised
 * artefacts from its training corpora, not translations of what was said, so a
 * quiet track comes back as "Thank you for watching!" or similar.
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /^(thank you|thanks)( very much)?( for watching)?$/,
  /^(thank|thanks) (you )?(so|very) much$/,
  /^(please )?(like( and)? )?subscribe( to (my|the) channel)?$/,
  /^(subtitles?|captions?)( by| created by)?$/,
  /^(subtitles?|captions?|transcribed) (by|created by) .+$/,
  /^amara org$/,
  /^(music|applause|laughter|silence|no speech|background noise|inaudible)$/,
  /^(you|hmm+|uh+|um+|ah+|er+m?)$/
];

const normaliseForMatching = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isRepetitionLoop = (normalised: string): boolean => {
  const words = normalised.split(' ').filter(Boolean);
  if (words.length < 4) return false;
  const unique = new Set(words);
  return unique.size === 1 || (unique.size <= 2 && words.length >= 6);
};

/** True when the text is a known artefact, filler, or a decoding loop. */
const isHallucinatedText = (text: string): boolean => {
  const normalised = normaliseForMatching(text);
  if (!normalised) return true;
  if (isRepetitionLoop(normalised)) return true;
  return HALLUCINATION_PATTERNS.some((pattern) => pattern.test(normalised));
};

/**
 * Discards a segment only when the confidence signals agree with each other, so
 * quiet-but-genuine speech is not thrown away on a single number.
 */
const isLowConfidenceSegment = (segment: GroqSegment): boolean => {
  if (
    typeof segment.compression_ratio === 'number' &&
    segment.compression_ratio >= MAX_COMPRESSION_RATIO
  ) {
    return true;
  }

  return (
    typeof segment.no_speech_prob === 'number' &&
    segment.no_speech_prob >= MAX_NO_SPEECH_PROB &&
    typeof segment.avg_logprob === 'number' &&
    segment.avg_logprob <= MIN_AVG_LOGPROB
  );
};

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
    // The declared type must match the bytes on disk, not what the browser emitted.
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: input.mimeType ?? 'audio/webm' }),
      path.basename(input.filePath)
    );
    form.append('model', env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3');
    form.append('response_format', 'verbose_json');
    // Greedy decoding: summaries of the same recording must not change between runs.
    form.append('temperature', '0');
    // English by default (GROQ_TRANSCRIBE_LANGUAGE). Unpinned, Whisper hears
    // noise on a quiet track, decides it is another language, and transliterates
    // it into nonsense. "auto" restores per-recording detection on purpose.
    const language = (input.language ?? env.GROQ_TRANSCRIBE_LANGUAGE ?? '').trim();
    if (language && language.toLowerCase() !== 'auto') {
      form.append('language', language);
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
      // Logged for operators only: the body can echo account detail and must not reach the client.
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
      .filter((segment) => !isLowConfidenceSegment(segment))
      .map((segment) => ({
        startMs: Math.round((segment.start ?? 0) * 1000),
        endMs: Math.round((segment.end ?? 0) * 1000),
        text: (segment.text ?? '').trim()
      }))
      .filter((segment) => segment.text.length > 0 && !isHallucinatedText(segment.text));

    // The top-level `text` repeats the segments verbatim, including the ones
    // just rejected, so it cannot be trusted. Rebuild it from what survived;
    // only trust it when the provider returned no segments to filter.
    const hasSegmentData = (payload.segments ?? []).length > 0;
    const fallbackText = (payload.text ?? '').trim();
    const text = hasSegmentData
      ? segments.map((segment) => segment.text).join(' ').trim()
      : isHallucinatedText(fallbackText)
        ? ''
        : fallbackText;

    if (hasSegmentData && segments.length === 0) {
      logger.warn(
        `Discarded every Whisper segment for ${path.basename(input.filePath)}: ` +
          `${(payload.segments ?? []).length} low-confidence or hallucinated segment(s)`
      );
    }

    return {
      text,
      language: payload.language ?? null,
      durationMs: typeof payload.duration === 'number' ? Math.round(payload.duration * 1000) : null,
      segments
    };
  }
}