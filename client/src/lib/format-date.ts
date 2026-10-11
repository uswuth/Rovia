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
