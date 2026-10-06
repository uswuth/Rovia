/** Mirrors server/src/types/socket.types.ts. Kept in sync by hand, not re-exported. */

export interface RTCSessionDescriptionInitLike {
  type?: string;
  sdp?: string;
}

export interface RTCIceCandidateInitLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface MeetingSignalPayload {
  meetingId: string;
  from: string;
  description?: RTCSessionDescriptionInitLike;
  candidate?: RTCIceCandidateInitLike;
}

export interface ServerToClientEvents {
  notification: (data: { message: string; timestamp: string }) => void;
  'meeting:peer-joined': (data: { userId: string }) => void;
  'meeting:peer-left': (data: { userId: string }) => void;
  'meeting:state': (data: { userId: string; state: Record<string, boolean | string> }) => void;
  'webrtc:offer': (data: MeetingSignalPayload) => void;
  'webrtc:answer': (data: MeetingSignalPayload) => void;
  'webrtc:ice': (data: MeetingSignalPayload) => void;
}

export interface ClientToServerEvents {
  ping: () => void;
  'meeting:join': (
    meetingId: string,
    ack?: (result: { ok: boolean; peers?: string[]; error?: string }) => void
  ) => void;
  'meeting:leave': (meetingId: string) => void;
  'meeting:state': (payload: { meetingId: string; state: Record<string, boolean | string> }) => void;
  'webrtc:offer': (payload: { meetingId: string; to: string; description: RTCSessionDescriptionInitLike }) => void;
  'webrtc:answer': (payload: { meetingId: string; to: string; description: RTCSessionDescriptionInitLike }) => void;
  'webrtc:ice': (payload: { meetingId: string; to: string; candidate: RTCIceCandidateInitLike }) => void;
}
