import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToastState } from '@/hooks/useToast';

export const SettingsToast = ({ toast }: { toast: ToastState | null }) => {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-xs border px-4 py-2.5 text-xs font-medium shadow-lg',
        toast.tone === 'success'
          ? 'bg-card border-primary/40 text-primary'
          : 'bg-card border-destructive/40 text-destructive'
      )}
    >
      {toast.tone === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      <span>{toast.message}</span>
    </div>
  );
};
