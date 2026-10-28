import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Organization } from '../models/organization.model.js';
import { Summary } from '../models/summary.model.js';
import { Transcript } from '../models/transcript.model.js';
import { logger } from '../utils/logger.js';

/**
 * AI usage is derived from the documents the pipeline already writes, plus the
 * provider's own key endpoint. Nothing here is sampled or invented: a null
 * means the provider did not report it, and the UI renders "unknown" rather
 * than a zero.
 */

const HISTORY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Rough token estimate: four characters per token is the usual English ratio. */
const CHARS_PER_TOKEN = 4;

// Documented free-tier ceilings for the models this deployment uses:
// Groq whisper-large-v3 (20 RPM / 2K RPD / 7.2K audio-s per hour / 28.8K per day)
// and OpenRouter :free models (20 RPM / 50 RPD until 10 credits have been bought).
// The OpenRouter ceiling is replaced by the live value from /api/v1/key when the
// key reports one.
const GROQ_FREE_TIER = {
  requestsPerMinute: 20,
  requestsPerDay: 2000,
  audioSecondsPerHour: 7200,
  audioSecondsPerDay: 28800
};
const OPENROUTER_FREE_TIER = {
  requestsPerMinute: 20,
  requestsPerDay: 50
};

export interface OpenRouterKeyInfo {
  label: string | null;
  isFreeTier: boolean;
  usageCredits: number | null;
  usageDailyCredits: number | null;
  usageMonthlyCredits: number | null;
  keyLimit: number | null;
  keyLimitRemaining: number | null;
  freeRequestsUsed: number | null;
  freeRequestsLimit: number | null;
  freeRequestsRemaining: number | null;
}

export interface AiUsageResponse {
  generatedAt: string;
  providers: {
    stt: {
      name: string;
      model: string;
      configured: boolean;
      requestsPerMinute: number;
      requestsPerDay: number;
      audioSecondsPerHour: number;
      audioSecondsPerDay: number;
    };
    summary: {
      name: string;
      model: string;
      fallbackModels: string[];
      configured: boolean;
      requestsPerMinute: number;
      requestsPerDay: number;
    };
    openRouter: OpenRouterKeyInfo | null;
    openRouterChecked: boolean;
  };
  totals: {
    transcripts: number;
    transcriptsReady: number;
    transcriptsFailed: number;
    transcriptsPending: number;
    summaries: number;
    summariesReady: number;
    summariesFailed: number;
    summariesPending: number;
    audioSeconds: number;
    speechMinutes: number;
    inputTokensEstimate: number;
    outputTokensEstimate: number;
    organizationsUsingAi: number;
  };
  today: {
    transcripts: number;
    summaries: number;
    failures: number;
    audioSeconds: number;
    audioMinutes: number;
  };
  quota: {
    stt: {
      usedAudioSeconds: number;
      limitAudioSeconds: number;
      percent: number;
      remainingAudioSeconds: number;
      remainingMinutes: number;
      avgAudioSecondsPerTranscript: number | null;
      estimatedTranscriptsRemaining: number | null;
    };
    summary: {
      usedRequests: number;
      limitRequests: number;
      percent: number;
      remainingRequests: number;
      limitSource: 'openrouter' | 'documented-default';
    };
  };
  daily: Array<{
    date: string;
    transcripts: number;
    summaries: number;
    failures: number;
    audioMinutes: number;
  }>;
  byOrganization: Array<{
    organizationId: string;
    organizationName: string;
    transcripts: number;
    summaries: number;
    failures: number;
    audioMinutes: number;
  }>;
  errors: {
    transcriptsFailed: number;
    summariesFailed: number;
    lastTranscriptFailureAt: string | null;
    lastSummaryFailureAt: string | null;
  };
}

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const percentOf = (used: number, limit: number): number => {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
};

const utcDateKey = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Reads the account-level quota straight from OpenRouter. Failure is expected
 * (missing key, provider outage, timeout) and must never break the dashboard,
 * so it degrades to null and the UI falls back to the documented free tier.
 */
const fetchOpenRouterKey = async (): Promise<OpenRouterKeyInfo | null> => {
  if (!env.OPENROUTER_API_KEY) return null;

  try {
    const baseUrl = (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/key`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      logger.warn(`OpenRouter key lookup returned ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as { data?: Record<string, unknown> };
    const data = payload.data ?? {};
    const free = (data.free_model_daily_requests ?? {}) as Record<string, unknown>;

    return {
      label: typeof data.label === 'string' ? data.label : null,
      isFreeTier: data.is_free_tier === true,
      usageCredits: asFiniteNumber(data.usage),
      usageDailyCredits: asFiniteNumber(data.usage_daily),
      usageMonthlyCredits: asFiniteNumber(data.usage_monthly),
      keyLimit: asFiniteNumber(data.limit),
      keyLimitRemaining: asFiniteNumber(data.limit_remaining),
      freeRequestsUsed: asFiniteNumber(free.used),
      freeRequestsLimit: asFiniteNumber(free.limit),
      freeRequestsRemaining: asFiniteNumber(free.remaining)
    };
  } catch (error) {
    logger.warn(`OpenRouter key lookup failed: ${(error as Error).message}`);
    return null;
  }
};

interface StatusAggregate {
  _id: string;
  count: number;
  audioMs: number;
}

interface DailyAggregate {
  _id: string;
  transcripts?: number;
  summaries?: number;
  failed?: number;
  audioMs?: number;
}

export const getAiUsageService = async (): Promise<AiUsageResponse> => {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const historyStart = new Date(todayStart.getTime() - (HISTORY_DAYS - 1) * DAY_MS);

  const [
    transcriptStatusRows,
    summaryStatusRows,
    todayTranscriptRows,
    todaySummaryRows,
    transcriptDailyRows,
    summaryDailyRows,
    transcriptCharRows,
    summaryCharRows,
    lastTranscriptFailure,
    lastSummaryFailure,
    transcriptByOrg,
    summaryByOrg,
    openRouter
  ] = await Promise.all([
    Transcript.aggregate<StatusAggregate>([
      {
        $group: {
          _id: '$transcript_status',
          count: { $sum: 1 },
          audioMs: { $sum: { $ifNull: ['$transcript_duration_ms', 0] } }
        }
      }
    ]),
    Summary.aggregate<StatusAggregate>([
      { $group: { _id: '$summary_status', count: { $sum: 1 }, audioMs: { $sum: 0 } } }
    ]),
    Transcript.aggregate<{ _id: null; count: number; failed: number; audioMs: number }>([
      { $match: { created_at: { $gte: todayStart } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$transcript_status', 'FAILED'] }, 1, 0] } },
          audioMs: { $sum: { $ifNull: ['$transcript_duration_ms', 0] } }
        }
      }
    ]),
    Summary.aggregate<{ _id: null; count: number; failed: number }>([
      { $match: { created_at: { $gte: todayStart } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$summary_status', 'FAILED'] }, 1, 0] } }
        }
      }
    ]),
    Transcript.aggregate<DailyAggregate>([
      { $match: { created_at: { $gte: historyStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          transcripts: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$transcript_status', 'FAILED'] }, 1, 0] } },
          audioMs: { $sum: { $ifNull: ['$transcript_duration_ms', 0] } }
        }
      }
    ]),
    Summary.aggregate<DailyAggregate>([
      { $match: { created_at: { $gte: historyStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          summaries: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$summary_status', 'FAILED'] }, 1, 0] } }
        }
      }
    ]),
    Transcript.aggregate<{ _id: null; chars: number }>([
      {
        $group: {
          _id: null,
          chars: { $sum: { $strLenCP: { $ifNull: ['$transcript_text', ''] } } }
        }
      }
    ]),
    Summary.aggregate<{ _id: null; chars: number }>([
      {
        $group: {
          _id: null,
          chars: { $sum: { $strLenCP: { $ifNull: ['$summary_text', ''] } } }
        }
      }
    ]),
    Transcript.findOne({ transcript_status: 'FAILED' })
      .sort({ updated_at: -1 })
      .select('updated_at')
      .lean<{ updated_at?: Date }>(),
    Summary.findOne({ summary_status: 'FAILED' })
      .sort({ updated_at: -1 })
      .select('updated_at')
      .lean<{ updated_at?: Date }>(),
    Transcript.aggregate<{ _id: mongoose.Types.ObjectId; transcripts: number; audioMs: number }>([
      {
        $group: {
          _id: '$organization_id',
          transcripts: { $sum: 1 },
          audioMs: { $sum: { $ifNull: ['$transcript_duration_ms', 0] } }
        }
      },
      { $sort: { transcripts: -1 } },
      { $limit: 10 }
    ]),
    Summary.aggregate<{ _id: mongoose.Types.ObjectId; summaries: number; failed: number }>([
      {
        $group: {
          _id: '$organization_id',
          summaries: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$summary_status', 'FAILED'] }, 1, 0] } }
        }
      }
    ]),
    fetchOpenRouterKey()
  ]);

  const transcriptStatus = { READY: 0, FAILED: 0, PENDING: 0, PROCESSING: 0 } as Record<string, number>;
  let audioSeconds = 0;
  for (const row of transcriptStatusRows) {
    transcriptStatus[row._id] = (transcriptStatus[row._id] ?? 0) + row.count;
    audioSeconds += (row.audioMs ?? 0) / 1000;
  }

  const summaryStatus = { READY: 0, FAILED: 0, PENDING: 0, PROCESSING: 0 } as Record<string, number>;
  for (const row of summaryStatusRows) {
    summaryStatus[row._id] = (summaryStatus[row._id] ?? 0) + row.count;
  }

  const transcripts = Object.values(transcriptStatus).reduce((sum, value) => sum + value, 0);
  const summaries = Object.values(summaryStatus).reduce((sum, value) => sum + value, 0);

  const todayTranscripts = todayTranscriptRows[0]?.count ?? 0;
  const todaySummaryCount = todaySummaryRows[0]?.count ?? 0;
  const todayFailures =
    (todayTranscriptRows[0]?.failed ?? 0) + (todaySummaryRows[0]?.failed ?? 0);
  const todayAudioSeconds = (todayTranscriptRows[0]?.audioMs ?? 0) / 1000;

  const dailyMap = new Map<string, { transcripts: number; summaries: number; failures: number; audioMs: number }>();
  for (let offset = 0; offset < HISTORY_DAYS; offset += 1) {
    const date = new Date(historyStart.getTime() + offset * DAY_MS);
    dailyMap.set(utcDateKey(date), { transcripts: 0, summaries: 0, failures: 0, audioMs: 0 });
  }
  for (const row of transcriptDailyRows) {
    const entry = dailyMap.get(row._id);
    if (entry) {
      entry.transcripts = row.transcripts ?? 0;
      entry.audioMs = row.audioMs ?? 0;
      entry.failures += row.failed ?? 0;
    }
  }
  for (const row of summaryDailyRows) {
    const entry = dailyMap.get(row._id);
    if (entry) {
      entry.summaries = row.summaries ?? 0;
      entry.failures += row.failed ?? 0;
    }
  }
  const daily = [...dailyMap.entries()].map(([date, entry]) => ({
    date,
    transcripts: entry.transcripts,
    summaries: entry.summaries,
    failures: entry.failures,
    audioMinutes: Math.round((entry.audioMs / 60000) * 10) / 10
  }));

  const historyTranscripts = daily.reduce((sum, day) => sum + day.transcripts, 0);
  const historyAudioSeconds = daily.reduce((sum, day) => sum + day.audioMinutes * 60, 0);
  const avgAudioSecondsPerTranscript =
    historyTranscripts > 0 ? Math.round(historyAudioSeconds / historyTranscripts) : null;

  const summaryLimit = openRouter?.freeRequestsLimit ?? OPENROUTER_FREE_TIER.requestsPerDay;
  const remainingAudioSeconds = Math.max(0, GROQ_FREE_TIER.audioSecondsPerDay - todayAudioSeconds);

  const orgIds = [...new Set([
    ...transcriptByOrg.map((row) => String(row._id)),
    ...summaryByOrg.map((row) => String(row._id))
  ])]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const organizations = orgIds.length > 0
    ? await Organization.find({ _id: { $in: orgIds } }).select('organization_name').lean<
        Array<{ _id: mongoose.Types.ObjectId; organization_name?: string }>
      >()
    : [];
  const orgNames = new Map(organizations.map((org) => [String(org._id), org.organization_name || 'Unnamed organization']));

  const orgUsage = new Map<string, { transcripts: number; summaries: number; failures: number; audioMs: number }>();
  const ensureOrg = (id: string) => {
    let entry = orgUsage.get(id);
    if (!entry) {
      entry = { transcripts: 0, summaries: 0, failures: 0, audioMs: 0 };
      orgUsage.set(id, entry);
    }
    return entry;
  };
  for (const row of transcriptByOrg) {
    const entry = ensureOrg(String(row._id));
    entry.transcripts = row.transcripts;
    entry.audioMs = row.audioMs ?? 0;
  }
  for (const row of summaryByOrg) {
    const entry = ensureOrg(String(row._id));
    entry.summaries = row.summaries;
    entry.failures = row.failed;
  }

  const byOrganization = [...orgUsage.entries()]
    .map(([organizationId, entry]) => ({
      organizationId,
      organizationName: orgNames.get(organizationId) ?? 'Unknown organization',
      transcripts: entry.transcripts,
      summaries: entry.summaries,
      failures: entry.failures,
      audioMinutes: Math.round((entry.audioMs / 60000) * 10) / 10
    }))
    .sort((a, b) => b.transcripts - a.transcripts);

  const transcriptChars = transcriptCharRows[0]?.chars ?? 0;
  const summaryChars = summaryCharRows[0]?.chars ?? 0;

  return {
    generatedAt: now.toISOString(),
    providers: {
      stt: {
        name: 'Groq',
        model: env.GROQ_TRANSCRIBE_MODEL ?? 'whisper-large-v3',
        configured: Boolean(env.GROQ_API_KEY),
        ...GROQ_FREE_TIER
      },
      summary: {
        name: 'OpenRouter',
        model: env.OPENROUTER_SUMMARY_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b:free',
        fallbackModels: env.OPENROUTER_FALLBACK_MODELS ?? [],
        configured: Boolean(env.OPENROUTER_API_KEY),
        requestsPerMinute: OPENROUTER_FREE_TIER.requestsPerMinute,
        requestsPerDay: summaryLimit
      },
      openRouter,
      openRouterChecked: Boolean(env.OPENROUTER_API_KEY)
    },
    totals: {
      transcripts,
      transcriptsReady: transcriptStatus.READY ?? 0,
      transcriptsFailed: transcriptStatus.FAILED ?? 0,
      transcriptsPending: (transcriptStatus.PENDING ?? 0) + (transcriptStatus.PROCESSING ?? 0),
      summaries,
      summariesReady: summaryStatus.READY ?? 0,
      summariesFailed: summaryStatus.FAILED ?? 0,
      summariesPending: (summaryStatus.PENDING ?? 0) + (summaryStatus.PROCESSING ?? 0),
      audioSeconds: Math.round(audioSeconds),
      speechMinutes: Math.round(audioSeconds / 60),
      inputTokensEstimate: Math.round(transcriptChars / CHARS_PER_TOKEN),
      outputTokensEstimate: Math.round(summaryChars / CHARS_PER_TOKEN),
      organizationsUsingAi: byOrganization.length
    },
    today: {
      transcripts: todayTranscripts,
      summaries: todaySummaryCount,
      failures: todayFailures,
      audioSeconds: Math.round(todayAudioSeconds),
      audioMinutes: Math.round((todayAudioSeconds / 60) * 10) / 10
    },
    quota: {
      stt: {
        usedAudioSeconds: Math.round(todayAudioSeconds),
        limitAudioSeconds: GROQ_FREE_TIER.audioSecondsPerDay,
        percent: percentOf(todayAudioSeconds, GROQ_FREE_TIER.audioSecondsPerDay),
        remainingAudioSeconds: Math.round(remainingAudioSeconds),
        remainingMinutes: Math.round(remainingAudioSeconds / 60),
        avgAudioSecondsPerTranscript,
        estimatedTranscriptsRemaining:
          avgAudioSecondsPerTranscript && avgAudioSecondsPerTranscript > 0
            ? Math.floor(remainingAudioSeconds / avgAudioSecondsPerTranscript)
            : null
      },
      summary: {
        usedRequests: todaySummaryCount,
        limitRequests: summaryLimit,
        percent: percentOf(todaySummaryCount, summaryLimit),
        remainingRequests: Math.max(0, summaryLimit - todaySummaryCount),
        limitSource: openRouter?.freeRequestsLimit ? 'openrouter' : 'documented-default'
      }
    },
    daily,
    byOrganization,
    errors: {
      transcriptsFailed: transcriptStatus.FAILED ?? 0,
      summariesFailed: summaryStatus.FAILED ?? 0,
      lastTranscriptFailureAt: lastTranscriptFailure?.updated_at
        ? new Date(lastTranscriptFailure.updated_at).toISOString()
        : null,
      lastSummaryFailureAt: lastSummaryFailure?.updated_at
        ? new Date(lastSummaryFailure.updated_at).toISOString()
        : null
    }
  };
};
