import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import type { LiveCaptionItem } from '@/hooks/useLiveCaptions';

export type CaptionFontSize = 'sm' | 'md' | 'lg';
export type CaptionOpacity = 20 | 40 | 60 | 80 | 100;

export interface LiveCaptionOverlayProps {
  enabled: boolean;
  activeCaption?: LiveCaptionItem | null;
  history?: LiveCaptionItem[];
  fontSize?: CaptionFontSize;
  opacity?: CaptionOpacity;
  className?: string;
}

const FONT_SIZE_MAP: Record<CaptionFontSize, { text: string; name: string }> = {
  sm: { text: 'text-xs', name: 'text-[11px]' },
  md: { text: 'text-sm', name: 'text-xs' },
  lg: { text: 'text-base', name: 'text-sm' },
};

const OPACITY_BG_MAP: Record<CaptionOpacity, string> = {
  20: 'bg-card/40 border-border/40',
  40: 'bg-card/60 border-border/60',
  60: 'bg-card/80 border-border/80',
  80: 'bg-card/95 border-border',
  100: 'bg-card border-border',
};

/**
 * Modern real-time caption component (Google Meet / Zoom style).
 * Reserves dedicated space that animates smoothly from/to the bottom bar when toggled.
 * Shows multi-turn dialogue with taller height so simultaneous or consecutive speaker
 * turns remain legible and engaging.
 */
export const LiveCaptionOverlay: React.FC<LiveCaptionOverlayProps> = ({
  enabled,
  activeCaption,
  history = [],
  fontSize = 'md',
  opacity = 80,
  className,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  const handleScroll = React.useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atEnd = scrollHeight - clientHeight - scrollTop <= 16;
    setIsAtBottom(atEnd);
  }, []);

  const jumpToLatest = React.useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setIsAtBottom(true);
    }
  }, []);

  // Auto-scroll to bottom of conversation whenever speech arrives if user is already at the bottom
  React.useEffect(() => {
    if (containerRef.current && isAtBottom) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [activeCaption?.text, history.length, isAtBottom]);

  // Group continuous conversation into speaker sessions where paragraphs flow under a single sticky name
  const groupedSpeakerSessions = React.useMemo(() => {
    interface SpeakerBlock {
      speakerName: string;
      paragraphs: Array<{ id: string; text: string; isActive?: boolean }>;
    }

    const blocks: SpeakerBlock[] = [];

    // Up to last 15 turns for smooth scrollback history
    const recentHistory = history.slice(-15);
    for (const h of recentHistory) {
      if (h.id !== activeCaption?.id && h.text.trim()) {
        const lastBlock = blocks[blocks.length - 1];

        if (lastBlock && lastBlock.speakerName === h.speakerName) {
          const lastPara = lastBlock.paragraphs[lastBlock.paragraphs.length - 1];
          // If the paragraph has grown beyond ~140 chars (~2-3 lines), start a new paragraph
          // under the SAME speaker without repeating the name tag
          if (lastPara && lastPara.text.length < 140) {
            lastPara.text = `${lastPara.text.replace(/[.,!?]+$/, '')}. ${h.text}`;
          } else {
            lastBlock.paragraphs.push({
              id: h.id,
              text: h.text,
            });
          }
        } else {
          // Brand new speaker: start a new speaker block
          blocks.push({
            speakerName: h.speakerName,
            paragraphs: [{ id: h.id, text: h.text }],
          });
        }
      }
    }

    if (activeCaption?.text?.trim()) {
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.speakerName === activeCaption.speakerName) {
        const lastPara = lastBlock.paragraphs[lastBlock.paragraphs.length - 1];
        if (lastPara && lastPara.text.length < 140) {
          lastPara.text = `${lastPara.text} ${activeCaption.text}`;
          lastPara.isActive = true;
        } else {
          lastBlock.paragraphs.push({
            id: activeCaption.id,
            text: activeCaption.text,
            isActive: true,
          });
        }
      } else {
        blocks.push({
          speakerName: activeCaption.speakerName,
          paragraphs: [{ id: activeCaption.id, text: activeCaption.text, isActive: true }],
        });
      }
    }

    return blocks;
  }, [history, activeCaption]);

  const fontClasses = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.md;
  const bgClass = OPACITY_BG_MAP[opacity] || OPACITY_BG_MAP[80];

  return (
    <div
      className={cn(
        "w-full shrink-0 flex justify-center px-0 pointer-events-none transition-all duration-300 ease-in-out relative z-20",
        className
      )}
    >
      <div
        className={cn(
          "w-full rounded-none border border-b-0 text-card-foreground shadow-lg backdrop-blur-md px-8 sm:px-16 md:px-24 lg:px-32 flex flex-col justify-start overflow-hidden relative",
          "transition-[height,max-height,opacity,padding,width] duration-300 ease-in-out origin-bottom",
          enabled
            ? "h-28 max-h-28 opacity-100 py-3 pointer-events-auto"
            : "h-0 max-h-0 opacity-0 py-0 border-transparent",
          bgClass
        )}
      >
        {groupedSpeakerSessions.length === 0 ? (
          <div className="flex items-center gap-2 py-1">
            <span className={cn("font-bold text-primary shrink-0 select-none", fontClasses.name)}>
              Captions:
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-4 leading-relaxed w-full h-full min-h-0">
            {/* Speaker Name column: completely outside mask, 100% solid, sticky at top */}
            <div className="shrink-0 sticky top-0 z-30 pt-0.5">
              <span
                className={cn(
                  "font-bold text-primary select-none drop-shadow-xs",
                  fontClasses.name
                )}
              >
                {groupedSpeakerSessions[groupedSpeakerSessions.length - 1]?.speakerName}:
              </span>
            </div>

            {/* Scrollable text column with scroll-fade applied ONLY to the text */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 h-full min-h-0 overflow-y-auto space-y-3 pr-1 select-text scroll-fade-y no-scrollbar relative min-w-0 pointer-events-auto"
            >
              {groupedSpeakerSessions.map((session, sIdx) => (
                <div
                  key={`speaker-${session.speakerName}-${sIdx}`}
                  className="space-y-2 w-full"
                >
                  {/* If previous speaker turns exist in scrollback, show their subtle name header */}
                  {sIdx < groupedSpeakerSessions.length - 1 && (
                    <span className={cn("font-bold text-primary/70 select-none block mb-1 text-[11px]")}>
                      {session.speakerName}:
                    </span>
                  )}
                  {session.paragraphs.map((para) => (
                    <p
                      key={para.id}
                      className={cn(
                        "font-medium break-words transition-opacity",
                        para.isActive ? "opacity-100 text-foreground" : "opacity-75 text-muted-foreground",
                        fontClasses.text
                      )}
                    >
                      {para.text}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Jump to latest button if user scrolled up */}
        {!isAtBottom && groupedSpeakerSessions.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute top-2 right-6 z-30 inline-flex items-center gap-1 px-2.5 py-1 rounded-xs bg-primary text-primary-foreground text-[11px] font-semibold shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            <ChevronDown size={13} />
            <span>Jump to latest</span>
          </button>
        )}
      </div>
    </div>
  );
};

