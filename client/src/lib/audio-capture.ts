/** Capture-side audio processing for meetings — always on, no UI toggle. Two layers, because no single mechanism covers every browser: Layer 1 — getUserMedia constraints. Chromium honors these (Chrome, Edge, Brave, Opera, Samsung Internet, Helium, Arc, Vivaldi); Firefox honors the standard three; Safari ignores audio-processing constraints entirely. Layer 2 — a Web Audio chain inserted between mic and WebRTC. Works on every engine and is the only thing that helps on Safari / iOS. Room-meeting "buzzing" has three causes: - Feedback loop (mic picks up speaker output) -> echo cancellation - Steady electrical hum below ~100Hz (ground loop, cheap USB mic) -> high-pass - Level pumping when someone leans in / steps back -> compression */
interface ChromeAudioConstraints extends MediaTrackConstraints {
  googEchoCancellation?: boolean;
  googNoiseSuppression?: boolean;
  googHighpassFilter?: boolean;
  googAutoGainControl?: boolean;
}

interface MeetingAudioConstraints extends ChromeAudioConstraints {
  // Legacy Firefox-only hints. Removed in current Firefox, ignored everywhere
  // else — harmless to keep for older Firefox forks (Waterfox, LibreWolf).
  mozEchoCancellation?: boolean;
  mozNoiseSuppression?: boolean;
  mozAutoGainControl?: boolean;
}

export const buildAudioConstraints = (deviceId?: string | null): MeetingAudioConstraints => ({
  ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
  // Standard — honored by Chromium and Firefox.
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Chromium-only: same three, applied even when the device driver reports off.
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googAutoGainControl: true,
  // Legacy Firefox-only; ignored elsewhere.
  mozEchoCancellation: true,
  mozNoiseSuppression: true,
  mozAutoGainControl: true,
});
