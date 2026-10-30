import React, { useEffect, useRef, useState } from 'react';
import { Users, Check, Share2, WifiHigh, WifiLow, WifiZero, Hand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTimeFormat } from '@/context/TimeFormatContext';
import type { RaisedHand } from '@/api/meeting/webrtc.types';

export interface MeetingHeaderProps {
  title: string;
  connectedCount: number;
  copied: boolean;
  onCopyLink?: () => void;
  onShareLink?: () => void;
  onOpenParticipants?: () => void;
  isParticipantsOpen?: boolean;
  raisedHands?: RaisedHand[];
  currentUserId?: string;
  canManage?: boolean;
  onLowerHand?: (userId?: string) => void;
}

export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  title,
  connectedCount,
  copied,
  onCopyLink,
  onShareLink = onCopyLink,
  onOpenParticipants,
  isParticipantsOpen = false,
  raisedHands = [],
  currentUserId,
  canManage = false,
  onLowerHand,
}) => {
  const [networkQuality, setNetworkQuality] = useState<'high' | 'low' | 'zero'>('high');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [showRaisedHands, setShowRaisedHands] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const { formatTimeStr } = useTimeFormat();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowRaisedHands(false);
      }
    };
    if (showRaisedHands) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRaisedHands]);

  useEffect(() => {
    const checkConnection = () => {
      if (!navigator.onLine) {
        setNetworkQuality('zero');
        setPingMs(null);
        return;
      }
      const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean; rtt?: number } })?.connection;
      if (conn) {
        const rtt = conn.rtt;
        if (typeof rtt === 'number') {
          setPingMs(rtt);
        }
        if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || (rtt && rtt > 300)) {
          setNetworkQuality('low');
        } else {
          setNetworkQuality('high');
        }
      } else {
        setNetworkQuality('high');
        setPingMs(24);
      }
    };

    checkConnection();
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    const conn = (navigator as unknown as { connection?: EventTarget })?.connection;
    conn?.addEventListener?.('change', checkConnection);

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
      conn?.removeEventListener?.('change', checkConnection);
    };
  }, []);

  const getNetworkBadge = () => {
    if (networkQuality === 'high') {
      const ping = pingMs && pingMs > 0 ? pingMs : 24;
      return {
        icon: <WifiHigh size={15} className="text-emerald-500 shrink-0" />,
        tooltip: `Signal: ${ping}ms`,
      };
    }
    if (networkQuality === 'low') {
      const ping = pingMs && pingMs > 0 ? pingMs : 320;
      return {
        icon: <WifiLow size={15} className="text-amber-500 shrink-0" />,
        tooltip: `Signal: ${ping}ms`,
      };
    }
    return {
      icon: <WifiZero size={15} className="text-red-500 shrink-0" />,
      tooltip: 'Signal: Offline',
    };
  };

  const net = getNetworkBadge();

  return (
    <header className="shrink-0 flex items-center justify-between border-b border-border/80 px-3 sm:px-6 h-14 bg-card shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <span className="text-[11px] sm:text-xs font-bold text-foreground font-mono shrink-0">
          {formatTimeStr(currentTime)}
        </span>
        <h1 className="truncate text-sm sm:text-base font-bold text-foreground max-w-[90px] xs:max-w-[140px] sm:max-w-none">{title}</h1>
        <Tooltip content={copied ? 'Link Shared / Copied!' : 'Share Meeting Link'} side="bottom">
          <Button
            variant="outline"
            size="sm"
            onClick={onShareLink || onCopyLink}
            className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-2 sm:px-3 rounded-sm border-border/80 bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer shrink-0 transition-colors shadow-xs"
          >
            {copied ? <Check size={14} className="text-primary" /> : <Share2 size={14} className="text-foreground" />}
            <span className="hidden xs:inline">{copied ? 'Shared!' : 'Share Link'}</span>
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground shrink-0">
        {raisedHands && raisedHands.length > 0 && (
          <div className="relative" ref={popoverRef}>
            <Tooltip content={`${raisedHands.length} ${raisedHands.length === 1 ? 'hand' : 'hands'} raised in call`} side="bottom">
              <button
                type="button"
                onClick={() => setShowRaisedHands((v) => !v)}
                className={cn(
                  'flex h-8 items-center justify-center gap-1.5 px-2.5 rounded-sm border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 shadow-xs',
                  showRaisedHands
                    ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                    : 'bg-accent/15 hover:bg-accent/25 text-accent-foreground border-accent/40'
                )}
                aria-label="Raised hands"
              >
                <Hand size={14} className="shrink-0 text-accent-foreground animate-pulse" />
                <span className="leading-none">{raisedHands.length}</span>
              </button>
            </Tooltip>

            {showRaisedHands && (
              <div className="absolute right-0 top-10 z-50 w-80 rounded-xs border border-border/80 bg-card/95 backdrop-blur-md p-3 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Hand size={14} className="text-accent-foreground" />
                    <span className="text-xs font-bold text-foreground">Raised Hands</span>
                    <Badge tone="neutral" className="text-[10px] px-1.5 py-0 rounded-full font-semibold">
                      {raisedHands.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          onLowerHand?.('all');
                          setShowRaisedHands(false);
                        }}
                        className="text-[10px] font-medium text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors cursor-pointer"
                      >
                        Lower all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowRaisedHands(false)}
                      className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      aria-label="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
                  {raisedHands.map((item, index) => {
                    const isYou = item.userId === currentUserId;
                    const rank = index + 1;
                    const name = isYou ? 'You' : item.userName || 'Member';
                    const initial = name.charAt(0).toUpperCase() || 'U';

                    const levelBg =
                      rank === 1
                        ? 'bg-accent/20 border-accent/40 shadow-xs'
                        : rank === 2
                          ? 'bg-accent/12 border-accent/25'
                          : rank === 3
                            ? 'bg-accent/6 border-accent/15'
                            : 'bg-muted/40 border-border/40';

                    const badgeTone =
                      rank === 1
                        ? 'bg-accent text-accent-foreground font-black'
                        : rank === 2
                          ? 'bg-accent/80 text-accent-foreground font-bold'
                          : rank === 3
                            ? 'bg-accent/60 text-accent-foreground font-semibold'
                            : 'bg-muted text-muted-foreground font-medium';

                    return (
                      <div
                        key={item.userId}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-sm border text-xs transition-colors',
                          levelBg
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('size-5 flex items-center justify-center rounded-full text-[10px] shrink-0', badgeTone)}>
                            #{rank}
                          </span>
                          <Avatar className="size-6 text-[9px] shrink-0">
                            <AvatarFallback name={name} className={cn('text-[9px] font-bold', getAvatarColorByName(name))}>
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-foreground text-xs leading-tight">
                              {name} {isYou && <span className="text-[10px] text-muted-foreground font-normal">(You)</span>}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {rank === 1 ? 'First in order' : rank === 2 ? 'Second in order' : rank === 3 ? 'Third in order' : `${rank}th in order`}
                            </span>
                          </div>
                        </div>

                        {(canManage || isYou) && (
                          <button
                            type="button"
                            onClick={() => onLowerHand?.(item.userId)}
                            className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-sm bg-background/80 hover:bg-background border border-border/50 shrink-0 cursor-pointer shadow-2xs transition-colors"
                          >
                            Lower
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Tooltip content={isParticipantsOpen ? 'Close Participants' : `${connectedCount} active ${connectedCount === 1 ? 'participant' : 'participants'}`} side="bottom">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenParticipants?.();
            }}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 px-3 rounded-sm border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 shadow-xs',
              isParticipantsOpen
                ? 'bg-secondary text-foreground border-border shadow-xs'
                : 'bg-secondary/50 hover:bg-secondary text-foreground border-border/80 hover:border-border'
            )}
            aria-label="Participants"
          >
            <Users size={14} className="text-primary shrink-0" />
            <span className="leading-none">{connectedCount}</span>
          </button>
        </Tooltip>

        <Tooltip content={net.tooltip} side="bottom" align="end">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-border/80 bg-secondary/50 hover:bg-secondary text-foreground transition-colors cursor-default select-none shrink-0 shadow-xs"
            aria-label={net.tooltip}
          >
            {net.icon}
          </div>
        </Tooltip>
      </div>
    </header>
  );
};
