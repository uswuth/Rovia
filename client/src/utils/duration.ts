/** Formats duration into human-readable compact time units. Examples: 30 -> "30m" 60 -> "1h" 360 -> "6h" 90 -> "1h 30m" 1440 -> "1d" 1500 -> "1d 1h" */
export const formatDurationHuman = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0m';

  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '0m';
};
