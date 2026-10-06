/**
 * Small helpers for the local AI adapters.
 */

/**
 * AbortSignal.timeout is not in the default TypeScript DOM lib, so the cast is
 * centralised here instead of being repeated in every adapter.
 */
export const timeoutSignal = (ms: number): AbortSignal => {
  const factory = (AbortSignal as unknown as { timeout?: (delay: number) => AbortSignal }).timeout;
  if (typeof factory === 'function') {
    return factory(ms);
  }
  // Fallback for runtimes without AbortSignal.timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  timer.unref?.();
  return controller.signal;
};
