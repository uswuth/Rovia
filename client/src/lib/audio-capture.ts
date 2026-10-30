/** Capture-side audio processing for meetings — always on, no UI toggle. Two layers, because no single mechanism covers every browser: Layer 1 — getUserMedia constraints. Chromium honors these (Chrome, Edge, Brave, Opera, Samsung Internet, Helium, Arc, Vivaldi); Firefox honors the standard three; Safari ignores audio-processing constraints entirely. Layer 2 — a Web Audio chain inserted between mic and WebRTC. Works on every engine and is the only thing that helps on Safari / iOS. Room-meeting "buzzing" has three causes: - Feedback loop (mic picks up speaker output) -> echo cancellation - Steady electrical hum below ~100Hz (ground loop, cheap USB mic) -> high-pass - Level pumping when someone leans in / steps back -> compression */
interface ChromeAudioConstraints extends MediaTrackConstraints {
  googEchoCancellation?: boolean;
  googNoiseSuppression?: boolean;
  googHighpassFilter?: boolean;
  googAutoGainControl?: boolean;
  channelCount?: number;
}

interface MeetingAudioConstraints extends ChromeAudioConstraints {
  mozEchoCancellation?: boolean;
  mozNoiseSuppression?: boolean;
  mozAutoGainControl?: boolean;
}

export const buildAudioConstraints = (deviceId?: string | null): MeetingAudioConstraints => ({
  ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
  // Standard — honored by Chromium and Firefox.
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: 1,
  // Chromium-only: applied at the WebRTC audio processing layer
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googAutoGainControl: true,
  // Legacy Firefox-only; ignored elsewhere.
  mozEchoCancellation: true,
  mozNoiseSuppression: true,
  mozAutoGainControl: true,
});

/**
 * Ensures optimal track audio settings on active audio tracks.
 * Applies ideal autoGainControl, noiseSuppression and echoCancellation directly to the track.
 */
export const enhanceAudioTrack = (track?: MediaStreamTrack | null): void => {
  if (!track || track.kind !== 'audio') return;
  try {
    void track.applyConstraints({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    }).catch(() => {
      // Fallback silently if browser does not support on-the-fly constraint adjustment
    });
  } catch {
    // Ignore unsupported environments
  }
};
