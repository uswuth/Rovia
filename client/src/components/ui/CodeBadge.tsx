import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CodeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  code?: string | null;
  fallback?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const CodeBadge: React.FC<CodeBadgeProps> = ({
  code,
  fallback = 'N/A',
  className,
  onClick,
  title,
  ...props
}) => {
  const displayCode = code || fallback;
  const isClickable = Boolean(onClick);

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          'inline-flex items-center font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm transition-all outline-none',
          'hover:bg-primary/20 hover:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary cursor-pointer',
          className
        )}
      >
        {displayCode}
      </button>
    );
  }

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm select-all',
        className
      )}
      {...props}
    >
      {displayCode}
    </span>
  );
};
