import React, { createContext, useContext, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsContextType {
  activeId: string;
  setActiveId: (id: string) => void;
  size: 'xs' | 'sm' | 'md';
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface CommonTabsProps {
  items?: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  children?: ReactNode;
}

export const CommonTabs: React.FC<CommonTabsProps> & {
  Panel: React.FC<{ id: string; children: ReactNode; className?: string }>;
} = ({
  items,
  value,
  defaultValue,
  onChange,
  onValueChange,
  size = 'xs',
  className,
  children,
}) => {
  const [internalId, setInternalId] = useState<string>(() => {
    return value ?? defaultValue ?? (items && items.length > 0 ? items[0].id : '');
  });

  const activeId = value !== undefined ? value : internalId;

  const handleSelect = (id: string) => {
    if (value === undefined) {
      setInternalId(id);
    }
    onChange?.(id);
    onValueChange?.(id);
  };

  const sizeClasses = {
    xs: 'h-7 text-xs px-2.5 gap-1.5',
    sm: 'h-8 text-xs px-3 gap-2',
    md: 'h-9 text-sm px-3.5 gap-2',
  }[size];

  return (
    <TabsContext.Provider value={{ activeId, setActiveId: handleSelect, size }}>
      <div className={cn('flex flex-col gap-3', className)}>
        {items && items.length > 0 && (
          <div className="flex items-center w-fit p-0.5 rounded-xs border border-border bg-card/60 backdrop-blur-xs select-none">
            {items.map((tab) => {
              const isSelected = activeId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelect(tab.id)}
                  className={cn(
                    'inline-flex items-center justify-center font-semibold rounded-xs transition-all duration-150 cursor-pointer outline-none whitespace-nowrap',
                    sizeClasses,
                    isSelected
                      ? 'bg-accent text-accent-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab.icon && (
                    <span className="shrink-0 flex items-center justify-center">
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const CommonTabPanel: React.FC<{
  id: string;
  children: ReactNode;
  className?: string;
}> = ({ id, children, className }) => {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.activeId !== id) {
    return null;
  }
  return <div className={cn('w-full focus-visible:outline-none', className)}>{children}</div>;
};

CommonTabs.Panel = CommonTabPanel;

export default CommonTabs;
