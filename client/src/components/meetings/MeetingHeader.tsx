import React, { useEffect, useState } from 'react';
import { Users, Check, Share2, WifiHigh, WifiLow, WifiZero } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export interface MeetingHeaderProps {
  title: string;
  connectedCount: number;
  copied: boolean;
  onCopyLink?: () => void;
  onShareLink?: () => void;
}

/** Top navigation and meeting status bar */
export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  title,
  connectedCount,
  copied,
  onCopyLink,
  onShareLink = onCopyLink,
}) => {
  const [networkQuality, setNetworkQuality] = useState<'high' | 'low' | 'zero'>('high');
  const [pingMs, setPingMs] = useState<number | null>(null);

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
    <header className="shrink-0 flex items-center justify-between border-b border-border px-6 h-14 bg-background">
      {/* Left: Meeting Title and Share Link Button */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="truncate text-base font-bold text-foreground">{title}</h1>
        <Tooltip content={copied ? 'Link Shared / Copied!' : 'Share Meeting Link'} side="bottom">
          <Button
            variant="outline"
            size="sm"
            onClick={onShareLink || onCopyLink}
            className="gap-1.5 text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary cursor-pointer shrink-0 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} className="text-foreground" />}
            <span>{copied ? 'Shared!' : 'Share Link'}</span>
          </Button>
        </Tooltip>
      </div>

      {/* Right: Participant Count & Network Status */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <Tooltip content={`${connectedCount} active ${connectedCount === 1 ? 'participant' : 'participants'}`} side="bottom">
          <div className="flex h-8 items-center justify-center gap-1.5 px-2 rounded-md hover:bg-secondary/60 transition-colors cursor-default select-none font-semibold text-foreground">
            <Users size={15} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold leading-none">{connectedCount}</span>
          </div>
        </Tooltip>

        <Tooltip content={net.tooltip} side="bottom" align="end">
          <div className="flex size-8 h-8 w-8 items-center justify-center rounded-md hover:bg-secondary/60 transition-colors cursor-default select-none" aria-label={net.tooltip}>
            {net.icon}
          </div>
        </Tooltip>
      </div>
    </header>
  );
};
