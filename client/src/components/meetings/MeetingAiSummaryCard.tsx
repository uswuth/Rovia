import React from 'react';
import { AlertCircle, CheckCircle2, Copy, ListChecks, Loader2, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { parseApiError } from '@/utils/apiError';
import type { MeetingSummary, Transcript } from '@/api/recording/recording.types';
import type { RecorderStage } from '@/hooks/useMeetingRecorder';

interface MeetingAiSummaryCardProps {
  stage: RecorderStage;
  error: string | null;
  summary?: MeetingSummary | null;
  transcript?: Transcript | null;
  rawAudioUrls?: Array<{ speakerId: string; speakerName: string; url: string }>;
  onCopyTranscript?: () => void;
  onClose?: () => void;
  /** Set false when the page renders the transcript in its own panel. */
  showTranscript?: boolean;
  title?: string;
  className?: string;
}

/** Transcript is shown in full and copyable so it can be pasted into any external AI tool. */
export const MeetingAiSummaryCard: React.FC<MeetingAiSummaryCardProps> = ({
  stage,
  error,
  summary,
  transcript,
  rawAudioUrls,
  onCopyTranscript,
  onClose,
  showTranscript = true,
  title = 'Meeting AI Summary',
  className = 'w-full max-w-3xl',
}) => {
  const [copied, setCopied] = React.useState(false);

  const speakers = (transcript?.transcriptSpeakers ?? []).filter(
    (speaker) => (speaker.speakerName || '').length > 0
  );

  if (stage === 'idle' && !summary && !transcript) return null;

  const handleCopy = async () => {
    const text = transcript?.transcriptText ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the textarea below stays selectable as a fallback.
      setCopied(false);
    }
    onCopyTranscript?.();
  };

  const isWorking = stage === 'uploading' || stage === 'processing';
  const summaryStatus = summary?.summaryStatus;
  const transcriptStatus = transcript?.transcriptStatus;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          {isWorking && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-xs"
            title="Close summary"
          >
            <X size={15} />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isWorking && !error && (
          <p className="text-sm text-muted-foreground">
            {stage === 'uploading'
              ? 'Uploading recording…'
              : 'Transcribing and summarising. This runs after the meeting and can take a minute for a long recording.'}
          </p>
        )}

        {summaryStatus === 'FAILED' && (
          <div className="flex items-start gap-2 rounded-sm border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Summarisation did not complete. The transcript below is unaffected and can
              be copied into any AI tool.
            </span>
          </div>
        )}

        {/* Captured Raw Audio Playback Section */}
        {rawAudioUrls && rawAudioUrls.length > 0 && (
          <section className="space-y-2 rounded-sm border border-border/80 bg-muted/30 p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <Volume2 className="size-3.5 text-primary" />
              <span>Full Meeting Recorded Audio</span>
            </h3>
            <div className="space-y-2">
              {rawAudioUrls.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {item.speakerName || `Track ${idx + 1}`}
                  </div>
                  <audio
                    controls
                    src={item.url}
                    className="w-full h-8 rounded-xs"
                    preload="metadata"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {summary?.summaryStatus === 'READY' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Summary ready</span>
            </div>
            <MarkdownRenderer content={summary.summaryText || ''} />

            {summary.summaryKeyPoints && summary.summaryKeyPoints.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Key points
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {summary.summaryKeyPoints.map((point, index) => (
                    <li key={`${point}-${index}`}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.summaryActionItems && summary.summaryActionItems.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListChecks className="size-3.5" />
                  Action items
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {summary.summaryActionItems.map((item, index) => (
                    <li
                      key={`${item.text}-${index}`}
                      className="flex flex-wrap items-baseline gap-2"
                    >
                      <span className="text-foreground">{item.text}</span>
                      {item.assignee && (
                        <span className="rounded-xs bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                          {item.assignee}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {showTranscript && transcript?.transcriptText && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Transcript by speaker
                {transcriptStatus === 'PROCESSING' && (
                  <span className="ml-2 font-normal normal-case">processing…</span>
                )}
              </h3>
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={copied}>
                <Copy className="mr-1.5 size-3.5" />
                {copied ? 'Copied' : 'Copy transcript'}
              </Button>
            </div>

            {/* Each participant was recorded on their own track, so their words are shown separately. */}
            {speakers.length > 0 ? (
              <div className="space-y-2">
                {speakers.map((speaker) => (
                  <div
                    key={speaker.speakerId ?? speaker.speakerName}
                    className="rounded-sm border border-border bg-muted/40 p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {speaker.speakerName || 'Participant'}
                      </span>
                      {!speaker.spoke && (
                        <span className="rounded-xs bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          no speech detected
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {speaker.spoke ? speaker.speakerText : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                readOnly
                aria-label="Raw meeting transcript"
                value={transcript.transcriptText}
                rows={8}
                className="w-full resize-y rounded-sm border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </section>
        )}

        {error && !transcript?.transcriptText && (
          <p className="text-xs text-muted-foreground">
            {parseApiError(error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
};