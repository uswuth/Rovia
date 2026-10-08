export const formatCountdown = (scheduledMs: number, now: number): string => {
  const totalMins = Math.max(1, Math.ceil((scheduledMs - now) / (60 * 1000)));

  const MINS_IN_YEAR = 525600; // 365 * 1440
  const MINS_IN_MONTH = 43200; // 30 * 1440
  const MINS_IN_DAY = 1440; // 24 * 60

  if (totalMins >= MINS_IN_YEAR) {
    const years = Math.floor(totalMins / MINS_IN_YEAR);
    const remMins = totalMins % MINS_IN_YEAR;
    const months = Math.floor(remMins / MINS_IN_MONTH);
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }

  if (totalMins >= MINS_IN_MONTH) {
    const months = Math.floor(totalMins / MINS_IN_MONTH);
    const remMins = totalMins % MINS_IN_MONTH;
    const days = Math.floor(remMins / MINS_IN_DAY);
    return days > 0 ? `${months}m ${days}d` : `${months}m`;
  }

  if (totalMins >= MINS_IN_DAY) {
    const days = Math.floor(totalMins / MINS_IN_DAY);
    const remMins = totalMins % MINS_IN_DAY;
    const hours = Math.floor(remMins / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (totalMins >= 60) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${totalMins}m`;
};