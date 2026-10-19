import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No matching results found',
  disabled = false,
  className,
  allowClear = false,
  clearLabel = 'None',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value !== '' && opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    // Exclude redundant empty string values to prevent duplicates with allowClear
    const baseOptions = options.filter((opt) => opt.value !== '');
    if (!search.trim()) return baseOptions;
    const q = search.toLowerCase();
    return baseOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={cn('relative w-full text-left', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs transition-colors',
          'hover:bg-accent/40 focus:outline-hidden focus:ring-1 focus:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 text-foreground',
          open && 'ring-1 ring-ring border-ring',
          !selectedOption && 'text-muted-foreground'
        )}
      >
        <span className="flex items-center gap-2 truncate flex-1 text-left">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-medium text-foreground">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="px-1.5 py-0.2 rounded-sm text-[10px] font-mono bg-muted text-muted-foreground border border-border/50">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1.5 text-muted-foreground">
          {allowClear && Boolean(value) && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 rounded-xs hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <ChevronsUpDown size={13} className="opacity-60" />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/60 bg-muted/20">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-hidden border-none p-0 focus:ring-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y-0 text-xs">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-hidden transition-colors',
                  !value && 'bg-accent/40 text-foreground font-medium'
                )}
              >
                <span className="flex-1 text-left italic">{clearLabel}</span>
                {!value && <Check size={13} className="text-primary shrink-0 ml-1.5" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = Boolean(value) && opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent/40 text-foreground font-medium',
                      opt.disabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="px-1 py-0.2 rounded-xs text-[9px] font-mono bg-muted/80 text-muted-foreground border border-border/50 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <p className="text-[10px] text-muted-foreground truncate leading-tight">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>
                    {isSelected && <Check size={13} className="text-primary shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
