import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Palette, Lock } from 'lucide-react';
import { CommonTabs } from '@/components/ui/common-tabs';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { AppearanceTab } from '@/components/settings/AppearanceTab';
import { SecurityTab } from '@/components/settings/SecurityTab';

type TabKey = 'profile' | 'appearance' | 'security';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Profile Details', icon: <User size={15} /> },
  { key: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { key: 'security', label: 'Security & Password', icon: <Lock size={15} /> },
];

/** Settings shell: header, tab nav, and routing to the per-tab feature components. */
export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

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

      <CommonTabs
        size="sm"
        value={activeTab}
        onChange={(val) => setActiveTab(val as TabKey)}
        items={TABS.map((t) => ({ id: t.key, label: t.label, icon: t.icon }))}
      />

      {/* Render the selected tab content */}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'appearance' && <AppearanceTab />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  );
};
