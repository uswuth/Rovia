import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Palette, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import { SecurityTab } from '@/components/settings/SecurityTab';

type SettingsTab = 'profile' | 'appearance' | 'security';

const TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Profile Details', icon: <User size={15} /> },
  { key: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { key: 'security', label: 'Security & Password', icon: <Lock size={15} /> },
];

/** Settings shell: header, tab nav, and routing to the per-tab feature components. */
export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <SettingsIcon className="text-primary" size={24} />
          <span>Settings</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal details, privacy parameters, display preferences, and account security.
        </p>
      </div>

      <div className="flex border-b border-border gap-2 text-sm font-medium">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold transition-all cursor-pointer -mb-px',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'appearance' && <AppearanceTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  );
};
