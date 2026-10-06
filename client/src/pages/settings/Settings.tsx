import React from 'react';
import { Settings as SettingsIcon, User, Shield, Key, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { maskEmail } from '@/utils/privacy';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { timeFormat, setTimeFormat, formatTimeStr } = useTimeFormat();
  const maskedEmail = maskEmail(user?.userEmail || 'arlo@solution.com');

  const sampleDate = new Date();

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <SettingsIcon className="text-emerald-500 dark:text-emerald-400" size={24} />
          <span>Settings</span>
        </h1>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        {/* Profile Info */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <User size={16} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Profile Details</h3>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-muted-foreground font-medium block mb-1">User Name</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md font-semibold text-foreground">
                {user?.userName || 'arlo'}
              </div>
            </div>
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Masked Email</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md font-mono text-muted-foreground">
                {maskedEmail}
              </div>
            </div>
            <div>
              <label className="text-muted-foreground font-medium block mb-1">Assigned Role</label>
              <div className="p-2.5 bg-secondary/70 border border-border/80 rounded-md text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Shield size={13} />
                {user?.userRole || 'SuperAdmin'}
              </div>
            </div>
          </div>
        </div>

        {/* Display & Time Preferences */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Clock size={16} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Time Display Format</h3>
          </div>
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Choose your preferred time format for meeting schedules, timers, and timestamps across the application.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTimeFormat('12h')}
                className={`flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer ${
                  timeFormat === '12h'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                }`}
              >
                <span className="text-sm font-bold">12-Hour</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeFormat('24h')}
                className={`flex items-center justify-center p-4 rounded-lg border transition-all cursor-pointer ${
                  timeFormat === '24h'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border/80 bg-secondary/50 text-muted-foreground hover:border-border hover:bg-secondary'
                }`}
              >
                <span className="text-sm font-bold">24-Hour</span>
              </button>
            </div>

            <div className="p-3 bg-secondary/70 border border-border/80 rounded-md flex items-center justify-between">
              <span className="text-muted-foreground">Current Live Preview:</span>
              <span className="font-mono font-bold text-foreground">{formatTimeStr(sampleDate)}</span>
            </div>
          </div>
        </div>

        {/* Security & Access */}
        <div className="rounded-md border border-border/80 bg-card/90 dark:bg-card/80 backdrop-blur-md text-card-foreground p-6 space-y-4 shadow-xs md:col-span-2">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Key size={16} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Security & Access</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-secondary/70 border border-border/80 rounded-md">
              <div>
                <div className="font-semibold text-foreground">Two-Factor Auth</div>
                <div className="text-[11px] text-muted-foreground">Enabled for SuperAdmin session</div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">Active</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-secondary/70 border border-border/80 rounded-md">
              <div>
                <div className="font-semibold text-foreground">Session Security</div>
                <div className="text-[11px] text-muted-foreground">JWT Token with secure fallback</div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">Secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
