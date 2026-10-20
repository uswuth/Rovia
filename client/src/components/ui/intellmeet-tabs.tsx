'use client';

import { Tabs } from '@heroui/react';
import { cn } from '@/lib/utils';
import type { ReactNode, Key } from 'react';

// Re-export Tabs so consumers can use Tabs.Panel without a separate import.
export { Tabs };

export type IntellMeetTabVariant = 'primary' | 'secondary' | 'underlined';

export type IntellMeetTabSize = 'xs' | 'sm' | 'lg';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

/** Size of the tab buttons: xs (24px), sm (28px), lg (36px). */
export interface IntellMeetTabsProps {
  /** Tab definitions rendered as buttons in the tab list. */
  tabs: TabDef[];
  /** Controlled selected key (tab id). */
  value?: string;
  /** Uncontrolled default selected key (tab id). */
  defaultValue?: string;
  /** Called with the new tab id when selection changes. */
  onValueChange?: (value: string) => void;
  /** HeroUI variant: "underlined" for the underline style. */
  variant?: IntellMeetTabVariant;
  /** Size of the tab buttons (xs = compact, sm = default, lg = expanded). */
  size?: IntellMeetTabSize;
  /** Accessible name for the tab list. */
  ariaLabel?: string;
  /** TabPanel elements matching tab ids. */
  children?: ReactNode;
  /** Extra classes for the root element. */
  className?: string;
}

/**
 * IntellMeetTabs — shared wrapper around HeroUI Tabs (RAC-backed).
 *
 * Provides xs-sized tabs with focus-visible rings, hover backgrounds, and
 * selected-state backgrounds. The variant prop controls the visual style:
 *   - "primary"  → filled bg behind selected tab (use in user-facing pages)
 *   - "secondary" → bottom underline on selected tab (use in admin/monitoring)
 *
 * Panel visibility and keyboard navigation are handled by React Aria Components.
 * Visual styling is applied entirely via Tailwind classes — no HeroUI CSS import
 * is required.
 */
export function IntellMeetTabs({
  tabs,
  value,
  defaultValue,
  size,
  variant = 'secondary',
  ariaLabel = 'Navigation tabs',
  children,
  className,
}: IntellMeetTabsProps) {
  const sizeClassMap = {
    xs: 'h-7 text-xs',
    sm: 'h-8 text-sm',
    lg: 'h-9 text-lg',
  } as const;

  // Variants: "primary" = filled pill (sharp corners), "secondary" = underline style
  const isPrimary = variant === 'primary';

  return (
    <Tabs
      selectedKey={value ?? defaultValue}
      defaultSelectedKey={defaultValue}
      orientation="horizontal"
      className={cn('intellmeet-tabs', className)}
    >
      <Tabs.List
        aria-label={ariaLabel}
        className={cn(
          'flex items-center gap-1 p-1 outline-none',
          isPrimary
            ? 'rounded-none border border-card/80 bg-card/40'
            : 'rounded-full border border-card/80 bg-card/40'
        )}
      >
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            className={cn(
              // Sizing
              sizeClassMap[size ?? 'xs'],
              // Base
              'relative flex items-center justify-center gap-2 px-4 font-semibold transition-all duration-150 ease-out outline-none whitespace-nowrap rounded-none',
              // Primary variant: filled pill (sharp corners)
              isPrimary && 'data-[selected]:bg-card data-[selected]:text-card-foreground data-[hovered]:bg-accent data-[hovered]:text-card-foreground',
              // Secondary variant: underline style
              !isPrimary && 'data-[selected]:border-b-2 data-[selected]:border-primary data-[selected]:bg-card data-[selected]:text-card-foreground data-[hovered]:bg-transparent data-[hovered]:text-muted-foreground',
              // Static tabs (no switching) — only for secondary variant
              'cursor-default',
              'whitespace-nowrap'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {children}
    </Tabs>
  );
}
