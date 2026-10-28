import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Mic,
  FileText,
  AlertTriangle,
  RefreshCw,
  Clock,
  Gauge,
  Coins,
  Activity,
  Database,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Chart } from '@tanstack/charts/react';
import { defineChart, areaY, lineY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { parseApiError } from '@/utils/apiError';
import {
  getAiUsageApi,
  type AiUsageData
} from '@/api/server-admin/server-admin.api';

const CHART_PRIMARY = '#10b981';
const CHART_SECONDARY = '#6366f1';

const formatMinutes = (minutes: number): string => {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.round(minutes)} min`;
};

const formatCredits = (value: number | null): string => {
  if (value === null) return '—';
  return `$${value.toFixed(4)}`;
};

const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
};

interface LevelBarProps {
  label: string;
  detail: string;
  percent: number;
}

const LevelBar: React.FC<LevelBarProps> = ({ label, detail, percent }) => {
  const tone = percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={cn('h-full rounded-sm transition-[width] duration-200 ease-out', tone)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: string;
}> = ({ label, value, hint, icon, tone = 'text-primary' }) => (
  <div className="rounded-sm border border-border/80 bg-card p-5 space-y-2 shadow-xs">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <span className={tone}>{icon}</span>
      <span>{label}</span>
    </div>
    <div className="text-2xl font-extrabold text-foreground">{value}</div>
    <p className="text-[11px] text-muted-foreground">{hint}</p>
  </div>
);

export const ServerAdminAiUsage: React.FC = () => {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsage = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await getAiUsageApi();
      setData(res.data?.data ?? null);
      setError('');
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await fetchUsage(true);
      if (cancelled) return;
    };

    void run();
    const interval = setInterval(() => {
      if (!cancelled) void fetchUsage(false);
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchUsage]);

  const dailyChartData = useMemo(
    () => (data?.daily ?? []).map((day) => ({ ...day, label: day.date.slice(5) })),
    [data]
  );

  const audioChartDef = useMemo(
    () =>
      defineChart({
        tooltip,
        marks: [
          areaY(dailyChartData, {
            x: 'label',
            y: 'audioMinutes',
            fill: CHART_PRIMARY,
            fillOpacity: 0.18
          }),
          lineY(dailyChartData, {
            x: 'label',
            y: 'audioMinutes',
            stroke: CHART_PRIMARY,
            strokeWidth: 2,
            points: true
          })
        ],
        scales: {
          x: {
            scale: () => scalePoint<string>().padding(0.2)
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: 'Audio minutes' }
          }
        }
      }),
    [dailyChartData]
  );

  const runsChartDef = useMemo(
    () =>
      defineChart({
        tooltip,
        marks: [
          lineY(dailyChartData, {
            x: 'label',
            y: 'transcripts',
            stroke: CHART_PRIMARY,
            strokeWidth: 2,
            points: true
          }),
          lineY(dailyChartData, {
            x: 'label',
            y: 'summaries',
            stroke: CHART_SECONDARY,
            strokeWidth: 2,
            points: true
          })
        ],
        scales: {
          x: {
            scale: () => scalePoint<string>().padding(0.2)
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: 'Runs per day' }
          }
        }
      }),
    [dailyChartData]
  );

  const hasRuns = Boolean(data && data.totals.transcripts + data.totals.summaries > 0);
  const openRouter = data?.providers.openRouter ?? null;
  const openRouterFreePercent =
    openRouter?.freeRequestsLimit && openRouter.freeRequestsUsed !== null
      ? Math.min(100, Math.round((openRouter.freeRequestsUsed / openRouter.freeRequestsLimit) * 100))
      : null;

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-border/40 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            <span>AI Usage &amp; Quotas</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Transcription (Groq) and summarisation (OpenRouter) consumption, against each provider's free tier.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{data ? new Date(data.generatedAt).toLocaleTimeString() : 'Syncing…'}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchUsage(true)}
            disabled={loading}
            className="h-8 cursor-pointer gap-1.5 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-emerald-500')} />
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-sm" />
          ))}
        </div>
      ) : !data ? (
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>AI usage could not be loaded</span>
            </div>
            <p className="text-xs text-muted-foreground">{error || 'The server did not return usage data.'}</p>
            <Button size="sm" variant="outline" onClick={() => void fetchUsage(true)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Speech processed today"
              value={formatMinutes(data.today.audioMinutes)}
              hint={`${data.today.audioSeconds.toLocaleString()} audio-seconds sent to Groq`}
              icon={<Mic className="h-4 w-4" />}
            />
            <KpiCard
              label="Transcript runs today"
              value={data.today.transcripts.toLocaleString()}
              hint={`${formatMinutes(data.totals.speechMinutes)} speech processed all-time`}
              icon={<Database className="h-4 w-4" />}
            />
            <KpiCard
              label="Summaries today"
              value={data.today.summaries.toLocaleString()}
              hint={`${data.totals.summariesReady.toLocaleString()} summaries ready all-time`}
              icon={<FileText className="h-4 w-4" />}
              tone="text-indigo-500"
            />
            <KpiCard
              label="Failures"
              value={`${(data.errors.transcriptsFailed + data.errors.summariesFailed).toLocaleString()}`}
              hint={`${data.errors.transcriptsFailed} transcripts · ${data.errors.summariesFailed} summaries`}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone={data.errors.transcriptsFailed + data.errors.summariesFailed > 0 ? 'text-destructive' : 'text-emerald-500'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border border-border/80 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Gauge className="h-4 w-4 text-emerald-500" />
                  <span>Free-tier level bars (today, UTC)</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  How much of today's allowance is spent, and what is left before new runs start failing.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <LevelBar
                  label="Groq transcription audio"
                  percent={data.quota.stt.percent}
                  detail={`${formatMinutes(data.quota.stt.usedAudioSeconds / 60)} of ${formatMinutes(data.quota.stt.limitAudioSeconds / 60)} used · ${formatMinutes(data.quota.stt.remainingMinutes)} left`}
                />
                <LevelBar
                  label="OpenRouter summary requests"
                  percent={data.quota.summary.percent}
                  detail={`${data.quota.summary.usedRequests} of ${data.quota.summary.limitRequests} used · ${data.quota.summary.remainingRequests} left${data.quota.summary.limitSource === 'documented-default' ? ' (documented free tier)' : ''}`}
                />

                <div className="rounded-sm border border-border/70 bg-muted/10 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Transcription runway
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {data.quota.stt.estimatedTranscriptsRemaining === null
                      ? 'Not enough history yet'
                      : `~${data.quota.stt.estimatedTranscriptsRemaining} more meetings today`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Based on an average of{' '}
                    {data.quota.stt.avgAudioSecondsPerTranscript === null
                      ? '—'
                      : formatMinutes(data.quota.stt.avgAudioSecondsPerTranscript / 60)}{' '}
                    of speech per meeting over the last 14 days.
                  </p>
                </div>

                <div className="rounded-sm border border-border/70 bg-muted/10 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Summary runway
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    ~{data.quota.summary.remainingRequests} more summaries today
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Each finished transcript sends one request to a free OpenRouter model.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span>OpenRouter balance</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Read live from the provider key; never includes the key itself.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {!data.providers.summary.configured ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    OpenRouter key is not configured on the server.
                  </p>
                ) : !openRouter ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Provider lookup unavailable. Showing documented limits only.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Tier</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          openRouter.isFreeTier
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {openRouter.isFreeTier ? 'FREE' : 'PAID'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Credits used (all time)</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatCredits(openRouter.usageCredits)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Credits used today</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatCredits(openRouter.usageDailyCredits)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Key limit remaining</span>
                      <span className="font-mono font-semibold text-foreground">
                        {openRouter.keyLimitRemaining === null
                          ? 'No key cap'
                          : formatCredits(openRouter.keyLimitRemaining)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Free requests today</span>
                      <span className="font-mono font-semibold text-foreground">
                        {openRouter.freeRequestsUsed === null || openRouter.freeRequestsLimit === null
                          ? '—'
                          : `${openRouter.freeRequestsUsed} / ${openRouter.freeRequestsLimit}`}
                      </span>
                    </div>
                    {openRouterFreePercent !== null && (
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-sm bg-muted"
                        role="progressbar"
                        aria-label="OpenRouter free requests used today"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={openRouterFreePercent}
                      >
                        <div
                          className={cn(
                            'h-full rounded-sm',
                            openRouterFreePercent >= 90
                              ? 'bg-destructive'
                              : openRouterFreePercent >= 70
                                ? 'bg-amber-500'
                                : 'bg-primary'
                          )}
                          style={{ width: `${openRouterFreePercent}%` }}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="border-t border-border/60 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estimated tokens (all time)
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Transcript input</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatTokens(data.totals.inputTokensEstimate)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Summary output</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatTokens(data.totals.outputTokensEstimate)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Estimated at four characters per token; providers do not return billed counts here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <span>Speech processed per day</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Last 14 days, minutes of audio sent to Groq.</p>
              </CardHeader>
              <CardContent>
                {hasRuns ? (
                  <div className="h-[220px] w-full">
                    <Chart definition={audioChartDef} height={210} ariaLabel="Audio minutes per day" />
                  </div>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                    <Activity className="h-6 w-6 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      No AI runs in the last 14 days. Record a meeting to populate this chart.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span>Transcripts vs summaries per day</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <span className="mr-3 inline-flex items-center gap-1 text-emerald-500">
                    <span className="h-1.5 w-3 rounded-sm bg-emerald-500" /> transcripts
                  </span>
                  <span className="inline-flex items-center gap-1 text-indigo-500">
                    <span className="h-1.5 w-3 rounded-sm bg-indigo-500" /> summaries
                  </span>
                </p>
              </CardHeader>
              <CardContent>
                {hasRuns ? (
                  <div className="h-[220px] w-full">
                    <Chart definition={runsChartDef} height={210} ariaLabel="Transcripts and summaries per day" />
                  </div>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                    <FileText className="h-6 w-6 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      No transcripts or summaries yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border border-border/80 shadow-xs lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>Errors</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Failed transcripts</span>
                  <span className="font-mono font-semibold text-foreground">
                    {data.errors.transcriptsFailed.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Last transcript failure</span>
                  <span className="text-right text-foreground">
                    {formatDateTime(data.errors.lastTranscriptFailureAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Failed summaries</span>
                  <span className="font-mono font-semibold text-foreground">
                    {data.errors.summariesFailed.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Last summary failure</span>
                  <span className="text-right text-foreground">
                    {formatDateTime(data.errors.lastSummaryFailureAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Failures today</span>
                  <span className="font-mono font-semibold text-foreground">{data.today.failures}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Database className="h-4 w-4 text-emerald-500" />
                  <span>Usage by organization</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.totals.organizationsUsingAi} organization{data.totals.organizationsUsingAi === 1 ? '' : 's'} with AI runs.
                </p>
              </CardHeader>
              <CardContent>
                {data.byOrganization.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No organization has used AI yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/50 font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5">Organization</th>
                          <th className="px-3 py-2.5 text-right">Transcripts</th>
                          <th className="px-3 py-2.5 text-right">Summaries</th>
                          <th className="px-3 py-2.5 text-right">Failures</th>
                          <th className="px-3 py-2.5 text-right">Audio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {data.byOrganization.map((org) => (
                          <tr key={org.organizationId} className="transition-colors hover:bg-muted/20">
                            <td className="px-3 py-2.5 font-semibold text-foreground">{org.organizationName}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                              {org.transcripts}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                              {org.summaries}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2.5 text-right font-mono',
                                org.failures > 0 ? 'text-destructive' : 'text-muted-foreground'
                              )}
                            >
                              {org.failures}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                              {formatMinutes(org.audioMinutes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/80 shadow-xs">
            <CardContent className="flex flex-col gap-2 p-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  STT: {data.providers.stt.name} / {data.providers.stt.model} ·{' '}
                  {data.providers.stt.configured ? 'configured' : 'not configured'}
                </span>
              </span>
              <span>
                Summaries: {data.providers.summary.name} / {data.providers.summary.model} ·{' '}
                {data.providers.summary.configured ? 'configured' : 'not configured'}
              </span>
              <span className="font-mono">
                {data.providers.stt.requestsPerMinute} RPM · {data.providers.stt.requestsPerDay.toLocaleString()} RPD
              </span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
