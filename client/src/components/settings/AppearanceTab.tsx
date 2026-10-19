import React from 'react';
import { Sun, Moon, Laptop, Palette, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/theme-context';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { updateUserDetailsApi } from '@/api/user/user-details.api';

interface AccentOption {
  name: string;
  hex: string;
}

const ACCENT_COLORS: AccentOption[] = [
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Amber', hex: '#EAB308' },
];

export const AppearanceTab: React.FC = () => {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { timeFormat, setTimeFormat, formatTimeStr } = useTimeFormat();
  const sampleDate = new Date();

  return (
    <div className="space-y-6">
      {/* Two-Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bento Left: Theme Switcher */}
        <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center text-primary">
                <Sun size={16} />
              </div>
              <h3 className="font-bold text-sm text-foreground">Theme Mode</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2.5 p-4 rounded-xs border transition-all cursor-pointer',
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                )}
              >
                <Sun size={20} className={theme === 'light' ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-xs">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2.5 p-4 rounded-xs border transition-all cursor-pointer',
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                )}
              >
                <Moon size={20} className={theme === 'dark' ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-xs">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2.5 p-4 rounded-xs border transition-all cursor-pointer',
                  theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                )}
              >
                <Laptop size={20} className={theme === 'system' ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-xs">System</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bento Right: Accent Color */}
        <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center text-primary">
                <Palette size={16} />
              </div>
              <h3 className="font-bold text-sm text-foreground">Accent Color Theme</h3>
            </div>

            <div className="space-y-4 pt-1">
              <div
                role="radiogroup"
                aria-label="Accent color"
                className="flex flex-wrap items-center justify-center gap-3.5"
              >
                {ACCENT_COLORS.map((opt) => {
                  const isSelected = accentColor?.toLowerCase() === opt.hex.toLowerCase();
                  return (
                    <button
                      key={opt.hex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Accent color: ${opt.name}`}
                      title={opt.name}
                      onClick={() => {
                        setAccentColor(opt.hex);
                        void updateUserDetailsApi({ accentColor: opt.hex });
                      }}
                      className={cn(
                        'size-9 rounded-full cursor-pointer transition-all duration-150 outline-none',
                        'focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'ring-2 ring-foreground scale-110 shadow-md'
                          : 'ring-1 ring-border hover:scale-105 hover:ring-foreground/40'
                      )}
                      style={{ backgroundColor: opt.hex }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Display Format */}
      <div className="rounded-xs border border-border/80 bg-card/90 backdrop-blur-md p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center text-primary">
            <Clock size={16} />
          </div>
          <h3 className="font-bold text-sm text-foreground">Time Display Format</h3>
        </div>
        <div className="space-y-4 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Choose your preferred time format for meeting schedules, timers, and timestamps across the application.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setTimeFormat('12h')}
              className={cn(
                'flex items-center justify-center p-4 rounded-xs border transition-all cursor-pointer',
                timeFormat === '12h'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
              )}
            >
              <span className="text-sm font-bold">12-Hour</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeFormat('24h')}
              className={cn(
                'flex items-center justify-center p-4 rounded-xs border transition-all cursor-pointer',
                timeFormat === '24h'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
              )}
            >
              <span className="text-sm font-bold">24-Hour</span>
            </button>
          </div>

          <div className="p-3 bg-secondary/70 border border-border/80 rounded-xs flex items-center justify-between max-w-md">
            <span className="text-muted-foreground">Live Preview:</span>
            <span className="font-mono font-bold text-primary">{formatTimeStr(sampleDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
