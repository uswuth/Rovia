import React from 'react';
import {
  MoreVertical,
  Sparkles,
  ScreenShare,
  ScreenShareOff,
  Captions,
  CaptionsOff,
  Settings,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PanelKey } from '../meetingPanels';

export interface MobileMoreMenuProps {
  isHost?: boolean;
  aiSummaryEnabled?: boolean;
  onToggleAiSummary?: () => void;
  // Screen Share
  isScreenSharing?: boolean;
  onToggleScreenShare?: () => void;
  // Captions
  captionsEnabled?: boolean;
  captionsSupported?: boolean;
  onToggleCaptions?: () => void;
  // Fullscreen & Settings
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenSettings: () => void;
  // Panels
  panel?: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
}

export const MobileMoreMenu: React.FC<MobileMoreMenuProps> = ({
  isHost,
  aiSummaryEnabled,
  onToggleAiSummary,
  isScreenSharing,
  onToggleScreenShare,
  captionsEnabled,
  captionsSupported,
  onToggleCaptions,
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
}) => {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-secondary cursor-pointer transition-colors shadow-xs"
            aria-label="More options"
          >
            <MoreVertical size={16} />
          </button>
        }
      />
      <PopoverContent
        side="top"
        sideOffset={12}
        align="end"
        className="w-56 p-1.5 space-y-1 border-border bg-card shadow-2xl rounded-xs text-xs animate-in fade-in zoom-in-95"
      >
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 border-b border-border/60">
          Meeting Options
        </div>

        {/* AI Summary Toggle (Host Only) */}
        {isHost && onToggleAiSummary && (
          <button
            type="button"
            onClick={onToggleAiSummary}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-left cursor-pointer transition-colors",
              aiSummaryEnabled
                ? "bg-purple-500/15 text-purple-400 font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2">
              <Sparkles size={15} className={aiSummaryEnabled ? "text-purple-400 animate-pulse" : "text-muted-foreground"} />
              <span>AI Summary</span>
            </span>
            {aiSummaryEnabled && <Check size={14} className="text-purple-400" />}
          </button>
        )}

        {/* Screen Share */}
        {onToggleScreenShare && (
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-left cursor-pointer transition-colors",
              isScreenSharing
                ? "bg-accent/20 text-accent-foreground font-medium"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className="flex items-center gap-2">
              {isScreenSharing ? (
                <ScreenShareOff size={15} className="text-accent-foreground" />
              ) : (
                <ScreenShare size={15} className="text-muted-foreground" />
              )}
              <span>{isScreenSharing ? 'Stop Presenting' : 'Share Screen'}</span>
            </span>
          </button>
        )}

        {/* Live Captions */}
        {onToggleCaptions && (
          <button
            type="button"
            onClick={captionsSupported ? onToggleCaptions : undefined}
            disabled={!captionsSupported}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-left transition-colors",
              !captionsSupported
                ? "opacity-50 cursor-not-allowed text-muted-foreground"
                : captionsEnabled
                ? "bg-primary/15 text-primary font-medium cursor-pointer"
                : "text-foreground hover:bg-muted cursor-pointer"
            )}
          >
            <span className="flex items-center gap-2">
              {captionsEnabled ? (
                <Captions size={15} className="text-primary" />
              ) : (
                <CaptionsOff size={15} className="text-muted-foreground" />
              )}
              <span>Live Subtitles</span>
            </span>
            {captionsEnabled && <Check size={14} className="text-primary" />}
          </button>
        )}

        {/* Fullscreen */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xs text-foreground hover:bg-muted text-left cursor-pointer transition-colors"
          >
            {isFullscreen ? <Minimize2 size={15} className="text-muted-foreground" /> : <Maximize2 size={15} className="text-muted-foreground" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        )}

        {/* Settings modal trigger */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xs text-foreground hover:bg-muted text-left cursor-pointer transition-colors border-t border-border/60 mt-1 pt-2"
        >
          <Settings size={15} className="text-muted-foreground" />
          <span>Meeting Settings</span>
        </button>
      </PopoverContent>
    </Popover>
  );
};
