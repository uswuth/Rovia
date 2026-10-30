export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const CAMERA_MAX_BITRATE = 3_000_000;

export const buildCameraConstraints = (deviceId?: string, exactDevice = false): MediaTrackConstraints => ({
  deviceId: deviceId && deviceId !== 'default' ? (exactDevice ? { exact: deviceId } : { ideal: deviceId }) : undefined,
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
});

export const applySenderBitrate = async (sender: RTCRtpSender, maxBitrate: number) => {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = maxBitrate;
    params.encodings[0].scaleResolutionDownBy = 1;
    await sender.setParameters(params);
  } catch {
    // Unsupported browser or early SDP state; setParameters safely ignored
  }
};

export const applyBitratesToConnection = (pc: RTCPeerConnection) => {
  const videoSender = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video')?.sender;
  if (videoSender) {
    void applySenderBitrate(videoSender, CAMERA_MAX_BITRATE);
  }
};
