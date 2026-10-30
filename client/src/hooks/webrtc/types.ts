export interface PeerState {
  userId: string;
  /** The remote MediaStream (camera/audio), ready to attach to a <video> element. */
  stream: MediaStream | null;
  screenStream?: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
}

export interface UseWebRtcMeetingOptions {
  visitorId?: string;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
  initialMic?: boolean;
  initialCamera?: boolean;
  onPeerLeft?: (userId: string) => void;
  onPeerJoined?: (userId: string) => void;
}
