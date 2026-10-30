import React from 'react';
import {
  Settings,
  X,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  Maximize2,
  Minimize2,
  Captions,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { useTheme } from '@/context/theme-context';
import type { CaptionFontSize, CaptionOpacity } from '@/components/ui/live-caption-overlay';

export interface MeetingViewSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  captionFontSize?: CaptionFontSize;
  onSelectCaptionFontSize?: (size: CaptionFontSize) => void;
  captionOpacity?: CaptionOpacity;
  onSelectCaptionOpacity?: (opacity: CaptionOpacity) => void;
}

export const MeetingViewSettingsModal: React.FC<MeetingViewSettingsModalProps> = ({
  open,
  onOpenChange,
  isFullscreen,
  onToggleFullscreen,
  captionFontSize = 'md',
  onSelectCaptionFontSize,
  captionOpacity = 'normal',
  onSelectCaptionOpacity,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip content={open ? undefined : "Meeting View Settings"} side="top" disabled={open}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex size-7 sm:size-9 w-7 sm:w-9 h-7 sm:h-9 min-w-7 sm:min-w-9 min-h-7 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              aria-label="Meeting View Settings"
            >
              <Settings size={15} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          }
        />
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className="w-68 p-3 space-y-3 border-border bg-card shadow-xl rounded-xs" align="end">
        <div className="font-bold text-xs text-foreground border-b border-border pb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Settings size={14} className="text-primary" />
            <span>Settings</span>
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-5 flex items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* 1. Appearance: Light / Dark / System */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-foreground">Appearance</span>
          <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xs border border-border/50">
            <button
              type="button"
              onClick={() => {
                if (theme !== 'light') toggleTheme();
              }}
              className={`flex items-center justify-center gap-1 py-1 rounded-xs text-[11px] font-medium transition-colors cursor-pointer ${theme === 'light'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Sun size={12} />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (theme !== 'dark') toggleTheme();
              }}
              className={`flex items-center justify-center gap-1 py-1 rounded-xs text-[11px] font-medium transition-colors cursor-pointer ${theme === 'dark'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Moon size={12} />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if ((systemDark && theme !== 'dark') || (!systemDark && theme !== 'light')) {
                  toggleTheme();
                }
              }}
              className="flex items-center justify-center gap-1 py-1 rounded-xs text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Monitor size={12} />
              <span>Auto</span>
            </button>
          </div>
        </div>

        {/* 2. Fullscreen Toggle */}
        <div className="space-y-1.5 pt-1 border-t border-border">
          <span className="text-[11px] font-semibold text-foreground">Screen View</span>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-full flex items-center justify-between p-2 rounded-xs border border-border bg-secondary/30 hover:bg-secondary text-xs text-foreground cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {isFullscreen ? <Minimize2 size={13} className="text-primary" /> : <Maximize2 size={13} className="text-primary" />}
              <span>{isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}</span>
            </span>
            <Kbd>F11</Kbd>
          </button>
        </div>

        {/* 3. Live Captions Preferences */}
        {onSelectCaptionFontSize && (
          <div className="space-y-2 pt-1 border-t border-border">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <Captions size={13} className="text-primary" />
              <span>Subtitles Appearance</span>
            </span>

            {/* Font Size Selector */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Subtitle Size</span>
              <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xs border border-border/50">
                {(['sm', 'md', 'lg'] as CaptionFontSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onSelectCaptionFontSize(size)}
                    className={`py-1 rounded-xs text-[10px] font-medium transition-colors uppercase cursor-pointer ${captionFontSize === size
                      ? 'bg-card text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Opacity Selector */}
            {onSelectCaptionOpacity && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Background Style</span>
                <div className="grid grid-cols-5 gap-1 bg-muted/40 p-1 rounded-xs border border-border/50">
                  {([20, 40, 60, 80, 100] as CaptionOpacity[]).map((opacity) => (
                    <button
                      key={opacity}
                      type="button"
                      onClick={() => onSelectCaptionOpacity(opacity)}
                      className={`py-1 rounded-xs text-[10px] font-medium transition-colors cursor-pointer ${captionOpacity === opacity
                        ? 'bg-card text-foreground shadow-xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {opacity}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Keyboard Shortcuts Cheatsheet */}
        <div className="space-y-1.5 pt-1 border-t border-border">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Keyboard size={13} className="text-primary" />
            <span>Shortcuts</span>
          </span>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between items-center py-0.5">
              <span>Toggle Mic</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Kbd>Alt</Kbd>+<Kbd>C</Kbd>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span>Toggle Camera</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Kbd>Alt</Kbd>+<Kbd>V</Kbd>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span>Mute / Deaf Audio</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Kbd>Alt</Kbd>+<Kbd>B</Kbd>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span>Mute All Three</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Kbd>Alt</Kbd>+<Kbd>N</Kbd>
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
