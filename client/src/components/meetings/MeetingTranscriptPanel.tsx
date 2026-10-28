import React from 'react';
import { Check, Copy, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Transcript, TranscriptSpeaker } from '@/api/recording/recording.types';

type TranscriptMode = 'clean' | 'raw';

interface MeetingTranscriptPanelProps {
  transcript?: Transcript | null;
  isLoading?: boolean;
  className?: string;
}

const speakerLabel = (speaker: TranscriptSpeaker): string => speaker.speakerName || 'Participant';

const speakerBody = (speaker: TranscriptSpeaker, mode: TranscriptMode): string => {
  if (!speaker.spoke) return '';
  if (mode === 'clean') return speaker.speakerCleanText ?? speaker.speakerText ?? '';
  return speaker.speakerText ?? '';
};

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * The raw speech-to-text for one meeting, exactly as it was transcribed, with
 * only the noise of speech removed. It sits beside the summary so a reader can
 * check any claim in the summary against what was actually said.
 *
 * Two versions are offered because they answer different questions: "Cleaned"
 * removes filler sounds, stutters and repeated words, while "Verbatim" is the
 * untouched model output for auditing.
 */
export const MeetingTranscriptPanel: React.FC<MeetingTranscriptPanelProps> = ({
  transcript,
  isLoading = false,
  className,
}) => {
  const [mode, setMode] = React.useState<TranscriptMode>('clean');
  const [copied, setCopied] = React.useState(false);

  const speakers = React.useMemo(
    () => (transcript?.transcriptSpeakers ?? []).filter((speaker) => (speaker.speakerName || '').length > 0),
    [transcript?.transcriptSpeakers]
  );

  // A cached response from before the cleaned field existed falls back to the raw
  // text rather than reporting the meeting as silent.
  const flatText =
    mode === 'clean'
      ? transcript?.transcriptCleanText ?? transcript?.transcriptText ?? ''
      : transcript?.transcriptText ?? '';
  const hasSpeech = speakers.some((speaker) => speaker.spoke) || flatText.trim().length > 0;
  const status = transcript?.transcriptStatus;
  const isProcessing = isLoading || status === 'PROCESSING' || status === 'PENDING';

  const plainText = React.useMemo(() => {
    if (speakers.length > 0) {
      return speakers
        .map((speaker) => {
          const body = speakerBody(speaker, mode);
          return body ? `${speakerLabel(speaker)}: ${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
    }
    return flatText;
  }, [speakers, mode, flatText]);

  const wordCount = React.useMemo(() => countWords(plainText), [plainText]);

  const handleCopy = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text stays selectable on screen.
      setCopied(false);
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="space-y-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <MessageSquareText className="size-4 text-primary" strokeWidth={1.75} />
              <span>Raw Meeting Transcript</span>
              {isProcessing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Word for word from the meeting. Nothing is paraphrased.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center rounded-xs border border-border bg-muted/40 p-0.5"
              role="group"
              aria-label="Transcript style"
            >
              <Button
                type="button"
                size="xs"
                variant={mode === 'clean' ? 'secondary' : 'ghost'}
                aria-pressed={mode === 'clean'}
                onClick={() => setMode('clean')}
                className="cursor-pointer"
              >
                Cleaned
              </Button>
              <Button
                type="button"
                size="xs"
                variant={mode === 'raw' ? 'secondary' : 'ghost'}
                aria-pressed={mode === 'raw'}
                onClick={() => setMode('raw')}
                className="cursor-pointer"
              >
                Verbatim
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopy()}
              disabled={!plainText || copied}
              className="cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {isLoading && !transcript ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : isProcessing ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Transcribing this recording. The transcript appears here when it is ready.
          </p>
        ) : !transcript ? (
          <div className="py-8 text-center">
            <p className="text-xs font-semibold text-foreground">No transcript yet</p>
            <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              Transcription runs automatically once a recorded meeting ends.
            </p>
          </div>
        ) : !hasSpeech ? (
          <div className="py-8 text-center">
            <p className="text-xs font-semibold text-foreground">No speech detected</p>
            <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              Every participant track was silent, so there is nothing to transcribe.
            </p>
          </div>
        ) : speakers.length > 0 ? (
          <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {speakers.map((speaker) => (
              <div
                key={speaker.speakerId ?? speaker.speakerName}
                className="rounded-sm border border-border bg-muted/30 p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{speakerLabel(speaker)}</span>
                  {!speaker.spoke && (
                    <span className="rounded-xs bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      no speech detected
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {speakerBody(speaker, mode)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="max-h-[620px] overflow-y-auto whitespace-pre-wrap pr-1 text-xs leading-relaxed text-muted-foreground">
            {flatText}
          </p>
        )}

        {hasSpeech && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>
              {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              {mode === 'clean' ? ' · filler sounds, stutters and repeats removed' : ' · untouched model output'}
            </span>
            {transcript?.transcriptLanguage && (
              <span className="font-mono uppercase">{transcript.transcriptLanguage}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
