export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  includeTime?: boolean;
}

/**
 * Common date formatter that safely parses strings, numbers, or Date instances.
 * Returns null if the value is missing or invalid.
 */
export const formatDate = (
  dateVal?: unknown,
  options?: FormatDateOptions
): string | null => {
  if (
    !dateVal ||
    (typeof dateVal !== 'string' && typeof dateVal !== 'number' && !(dateVal instanceof Date))
  ) {
    return null;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;

  const defaultOptions: Intl.DateTimeFormatOptions =
    options?.includeTime === false
      ? {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      : {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        };

  return d.toLocaleDateString(undefined, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Formats a date without the time portion (e.g., 'Oct 11, 2026').
 */
export const formatDateOnly = (dateVal?: unknown): string | null =>
  formatDate(dateVal, { includeTime: false });

/**
 * Formats duration in minutes to human readable string (e.g., 360 -> "6h", 90 -> "1h 30m", 45 -> "45m")
 */
export const formatDuration = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
};
