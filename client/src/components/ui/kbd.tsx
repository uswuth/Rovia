import * as React from 'react';
import { cn } from '@/lib/utils';

export type KbdProps = React.HTMLAttributes<HTMLElement>;

/** Standard shadcn-style Kbd component for displaying keyboard shortcuts */
export const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          'inline-flex h-5 min-w-5 select-none items-center justify-center rounded border border-border bg-muted/80 px-1.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-2xs transition-colors',
          className
        )}
        {...props}
      >
        {children}
      </kbd>
    );
  }
);
Kbd.displayName = 'Kbd';
