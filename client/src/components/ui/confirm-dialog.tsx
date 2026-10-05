import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  overlayClassName?: string;
  className?: string;
  /** When provided, positions the confirmation window near this target rect rather than screen center */
  anchorRect?: DOMRect | null;
}

/**
 * Common reusable confirmation dialog.
 * Supports anchored popover positioning near the trigger action icon as well as centered display.
 * Layout: Icon on the left, title & description on the right, action buttons at the bottom.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  anchorRect,
  onOpenChange,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  icon,
  onConfirm,
  onCancel,
  overlayClassName,
  className,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (!nextOpen && onClose) {
        onClose();
      }
    },
    [onOpenChange, onClose]
  );

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleOpenChange]);

  if (!open) return null;

  // Calculate anchored fixed position if anchorRect is provided
  const positionStyle: React.CSSProperties = anchorRect
    ? (() => {
        const dialogWidth = 310;
        const dialogHeight = 130;

        const spaceBelow = window.innerHeight - anchorRect.bottom;
        const top =
          spaceBelow >= dialogHeight + 16
            ? anchorRect.bottom + 6
            : Math.max(12, anchorRect.top - dialogHeight - 6);

        // Align right edge to the trigger button's right edge
        const right = Math.max(
          12,
          Math.min(
            window.innerWidth - anchorRect.right,
            window.innerWidth - dialogWidth - 12
          )
        );

        return {
          position: 'fixed',
          top: `${top}px`,
          right: `${right}px`,
        };
      })()
    : {};

  const isAnchored = Boolean(anchorRect);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        isAnchored ? 'bg-transparent' : 'flex items-center justify-center bg-transparent p-4',
        overlayClassName
      )}
      onClick={() => handleOpenChange(false)}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        style={positionStyle}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[315px] rounded-xl border border-border/90 dark:border-zinc-700/90 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md p-3.5 shadow-2xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.9)] outline-none animate-in fade-in-0 zoom-in-95',
          className
        )}
      >
        {/* Top: Icon on left side, Content (Title + Description) on right side */}
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/25 shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-sm font-semibold text-foreground leading-tight">{title}</h4>
            <div className="text-xs text-muted-foreground leading-snug">{description}</div>
          </div>
        </div>

        {/* Bottom: Two buttons (NO separator line) */}
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => {
              onCancel?.();
              handleOpenChange(false);
            }}
            className="h-7.5 px-3 text-xs bg-secondary/80 hover:bg-secondary text-foreground cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={() => {
              onConfirm();
              handleOpenChange(false);
            }}
            className={cn(
              'h-7.5 px-3 text-xs cursor-pointer font-medium',
              variant === 'destructive'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
