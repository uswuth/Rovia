/** AbortSignal.timeout is missing from the default TS DOM lib, so the cast lives here once. */
export const timeoutSignal = (ms: number): AbortSignal => {
  const factory = (AbortSignal as unknown as { timeout?: (delay: number) => AbortSignal }).timeout;
  if (typeof factory === 'function') {
    return factory(ms);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  timer.unref?.();
  return controller.signal;
};
