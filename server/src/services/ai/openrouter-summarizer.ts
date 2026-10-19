import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/apiError.js';
import { timeoutSignal } from '../../utils/ai.js';
import { SummarizationInput, SummarizationResult, SummaryActionItem, Summarizer } from '../../types/index.js';

/** OpenRouter adapter for Summarizer. Talks the OpenAI-compatible /chat/completions shape against a free text model. Only text is ever sent: the transcript. No audio, no meeting metadata. The model is instructed to stay grounded in the transcript, and its output is validated defensively before it is stored, so a malformed response is a failure rather than corrupt data. Validation is hand-rolled on purpose: the server has no schema library and adding one would introduce a new architectural style. */

const groundedPrompt = (transcript: string, recordingTitle?: string): string => `You summarise meeting transcripts.

Rules you must follow:
- Use ONLY information present in the transcript. Never invent people, dates, decisions, numbers or commitments.
- If nothing was decided or assigned, return empty arrays. An empty array is correct and better than a guess.
- actionItems are only things someone agreed to do. Put a person name in "assignee" only if the transcript names them.
- Keep the summary factual and under 120 words.
${recordingTitle ? `- The meeting is titled: "${recordingTitle}". Treat it as context, not as fact.` : ''}

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
  throw new ApiError(502, 'Summarisation model did not return JSON');
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString).filter((item) => item.length > 0) : [];

/** Defensive normalisation: anything unexpected becomes a safe default. */
const parseResult = (raw: Record<string, unknown>): SummarizationResult => {
  const summary = asString(raw.summary);
  if (!summary) {
    throw new ApiError(502, 'Summarisation model returned an unusable summary');
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

export class OpenRouterSummarizer implements Summarizer {
  async summarize(input: SummarizationInput): Promise<SummarizationResult> {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, 'Summarisation provider is not configured');
    }

    const baseUrl = (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

    // The free tier is shared and individual models are frequently saturated, so
    // one model is not dependable enough to fail a user's summary over. Try the
    // configured model first, then each fallback, and only surface an error once
    // every candidate has been exhausted.
    const models = [
      env.OPENROUTER_SUMMARY_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
      ...(env.OPENROUTER_FALLBACK_MODELS ?? [])
    ].filter((model, index, all) => Boolean(model) && all.indexOf(model) === index);

    let lastFailure: ApiError | null = null;

    for (const model of models) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            // OpenRouter attributes traffic to the calling app. Neither is a secret.
            'HTTP-Referer': env.CLIENT_URL || 'http://localhost:5173',
            'X-Title': 'IntellMeet'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: groundedPrompt(input.transcript, input.recordingTitle) }],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: 'json_object' }
          }),
          signal: timeoutSignal(env.OPENROUTER_TIMEOUT_MS ?? 180000)
        });
      } catch (error) {
        // A transport failure is not model-specific, so retrying the fallback
        // would only reach the same unreachable host.
        throw new ApiError(503, `Summarisation provider is unavailable: ${(error as Error).message}`);
      }

      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const content = payload.choices?.[0]?.message?.content ?? '';
        try {
          return parseResult(extractJson(content));
        } catch (error) {
          // The model answered with unusable output. A different candidate may
          // behave better than failing the whole summary.
          logger.warn(`OpenRouter model ${model} returned unusable output`);
          lastFailure = error as ApiError;
          continue;
        }
      }

      // Logged for operators, never returned to the client: the body can echo
      // account detail and must not reach the UI.
      const detail = await response.text().catch(() => '');
      logger.warn(`OpenRouter model ${model} returned ${response.status}: ${detail.slice(0, 200)}`);

      if (response.status === 401 || response.status === 403) {
        // Credentials are account-wide, so no other model would succeed.
        throw new ApiError(502, 'Summarisation provider rejected the configured credentials');
      }
      if (response.status === 429) {
        lastFailure = new ApiError(429, 'Summarisation provider rate limit reached, please retry shortly');
        continue;
      }
      lastFailure = new ApiError(502, 'Summarisation provider failed');
    }

    throw lastFailure ?? new ApiError(502, 'Summarisation provider failed');
  }
}