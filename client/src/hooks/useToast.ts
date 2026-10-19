import { useCallback, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error';

export interface ToastState {
  message: string;
  tone: ToastTone;
}

/**
 * Minimal toast: state + auto-dismiss. The repo has no shared toast system
 * (each surface that needs one rolls its own), so this is the per-surface
 * fallback used by the settings tabs.
 */
export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ message, tone });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  return { toast, showToast };
};
