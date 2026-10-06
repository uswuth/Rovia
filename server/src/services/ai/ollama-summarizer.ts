import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/apiError.js';
import { timeoutSignal } from '../../utils/ai.js';
import { SummarizationInput, SummarizationResult, SummaryActionItem, Summarizer } from '../../types/index.js';

/**
 * Local Ollama adapter for Summarizer.
 *
 * Runs entirely on the developer machine. The model is instructed to stay
 * grounded in the transcript, and its output is validated defensively before it
 * is stored, so a malformed response is a failure rather than corrupt data.
 *
 * Validation is hand-rolled on purpose: the server has no schema library and
 * adding one would introduce a new architectural style.
 */

const groundedPrompt = (transcript: string): string => `You summarise meeting transcripts.

Rules you must follow:
- Use ONLY information present in the transcript. Never invent people, dates, decisions, numbers or commitments.
- If nothing was decided or assigned, return empty arrays. An empty array is correct and better than a guess.
- actionItems are only things someone agreed to do. Put a person name in "assignee" only if the transcript names them.
- Keep the summary factual and under 120 words.

Transcript:
"""
${transcript}
"""

Reply with JSON only, no prose and no code fences, in exactly this shape:
{"summary":"...","keyPoints":["..."],"actionItems":[{"text":"...","assignee":null}]}`;

/** Models often wrap JSON in prose or fences despite instructions. */
const extractJson = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const candidates = [trimmed];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }
  throw new ApiError(502, 'Local model did not return JSON');
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString).filter((item) => item.length > 0) : [];

/** Defensive normalisation: anything unexpected becomes a safe default. */
const parseResult = (raw: Record<string, unknown>): SummarizationResult => {
  const summary = asString(raw.summary);
  if (!summary) {
    throw new ApiError(502, 'Local model returned an unusable summary');
  }

  const actionItems: SummaryActionItem[] = (Array.isArray(raw.actionItems) ? raw.actionItems : [])
    .map((item) => {
      if (typeof item === 'string') return { text: asString(item), assignee: null };
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const text = asString(record.text);
        return text ? { text, assignee: asString(record.assignee) || null } : null;
      }
      return null;
    })
    .filter((item): item is SummaryActionItem => item !== null);

  return { summary, keyPoints: asStringArray(raw.keyPoints), actionItems };
};

export class OllamaSummarizer implements Summarizer {
  async summarize(input: SummarizationInput): Promise<SummarizationResult> {
    const baseUrl = (env.OLLAMA_BASE_URL || 'http://ollama:11434').replace(/\/$/, '');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          prompt: groundedPrompt(input.transcript),
          // "format" makes Ollama constrain generation to valid JSON.
          format: 'json',
          stream: false,
          options: { temperature: 0.1 }
        }),
        signal: timeoutSignal(env.OLLAMA_TIMEOUT_MS ?? 180000)
      });
    } catch (error) {
      throw new ApiError(503, `Local summarisation service is unavailable: ${(error as Error).message}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error(`Ollama returned ${response.status}: ${detail.slice(0, 300)}`);
      throw new ApiError(502, 'Local summarisation service failed');
    }

    const payload = (await response.json()) as { response?: string };
    return parseResult(extractJson(payload.response ?? ''));
  }
}
