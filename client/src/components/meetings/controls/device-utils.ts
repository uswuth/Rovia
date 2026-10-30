export type ShelfType = 'mic' | 'camera' | 'speaker' | null;

export const getCleanDeviceLabel = (
  device: MediaDeviceInfo | undefined,
  type: 'Microphone' | 'Camera' | 'Speaker',
  index: number
): string => {
  if (!device) return `Default ${type}`;
  if (device.label && device.label.trim()) return device.label.trim();
  if (device.deviceId === 'default') return `Default ${type}`;
  return `${type} ${index >= 0 ? index + 1 : 1}`;
};
