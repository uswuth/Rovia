import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeetingSocket, disconnectMeetingSocket, type MeetingSocket } from '@/api/meeting/meeting-socket';
import type { MeetingSignalPayload } from '@/api/meeting/webrtc.types';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export interface PeerState {
  userId: string;
  /** The remote MediaStream, ready to attach to a <video> element. */
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
}

/**
 * Peer-to-peer meeting mesh.
 *
 * The server only relays SDP and ICE; media never touches it. The joining
 * peer offers to everyone already in the room, which avoids the "glare" of
 * both sides offering at once.
 */
export const useWebRtcMeeting = (
  meetingId: string,
  enabled: boolean,
  options?: { onPeerLeft?: (userId: string) => void }
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<MeetingSocket | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  // Peer connections are kept in a ref, not state: they are mutable objects
  // and re-rendering on every change would thrash the video elements.
  const connections = useRef<Record<string, RTCPeerConnection>>({});
  const onPeerLeftRef = useRef(options?.onPeerLeft);
  useEffect(() => {
    onPeerLeftRef.current = options?.onPeerLeft;
  }, [options?.onPeerLeft]);

  const upsertPeer = useCallback((userId: string, patch: Partial<PeerState>) => {
    setPeers((prev) => ({
      ...prev,
      [userId]: {
        userId,
        stream: prev[userId]?.stream ?? null,
        audioEnabled: prev[userId]?.audioEnabled ?? true,
        videoEnabled: prev[userId]?.videoEnabled ?? true,
        screenSharing: prev[userId]?.screenSharing ?? false,
        ...patch
      }
    }));
  }, []);

  const createConnection = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      const existing = connections.current[userId];
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      connections.current[userId] = pc;

      if (localRef.current) {
        localRef.current.getTracks().forEach((track) => pc.addTrack(track, localRef.current as MediaStream));
      }

      const remote = new MediaStream();
      upsertPeer(userId, { stream: remote });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => remote.addTrack(track));
        upsertPeer(userId, { stream: remote });
        setStatus('connected');
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit('webrtc:ice', {
          meetingId,
          to: userId,
          candidate: event.candidate.toJSON()
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setStatus('connected');
        if (['failed', 'closed'].includes(pc.connectionState)) {
          setError(`Connection to ${userId} ${pc.connectionState}`);
        }
      };

      if (initiator) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('webrtc:offer', { meetingId, to: userId, description: offer });
        })();
      }

      return pc;
    },
    [meetingId, upsertPeer]
  );

  useEffect(() => {
    if (!enabled || !meetingId) return undefined;

    let cancelled = false;

    const start = async () => {
      setStatus('connecting');
      try {
        // Camera/mic first: a denied permission should fail loudly, not
        // silently produce a peer with no tracks.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        setError((err as Error).message || 'Camera and microphone are required');
        setStatus('failed');
        return;
      }

      const socket = getMeetingSocket();
      socketRef.current = socket;

      socket.on('meeting:peer-joined', ({ userId }) => {
        // The newcomer offers; we just answer. One side offers, never both.
        createConnection(userId, false);
        upsertPeer(userId, {});
      });

      socket.on('meeting:peer-left', ({ userId }) => {
        connections.current[userId]?.close();
        delete connections.current[userId];
        setPeers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        onPeerLeftRef.current?.(userId);
      });

      socket.on('meeting:state', ({ userId, state }) => {
        upsertPeer(userId, {
          audioEnabled: typeof state.audioEnabled === 'boolean' ? state.audioEnabled : true,
          videoEnabled: typeof state.videoEnabled === 'boolean' ? state.videoEnabled : true,
          screenSharing: typeof state.screenSharing === 'boolean' ? state.screenSharing : false
        });
      });

      socket.on('webrtc:offer', async (data: MeetingSignalPayload) => {
        const pc = createConnection(data.from, false);
        if (data.description) await pc.setRemoteDescription(data.description as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { meetingId, to: data.from, description: answer });
      });

      socket.on('webrtc:answer', async (data: MeetingSignalPayload) => {
        const pc = connections.current[data.from];
        if (pc && data.description) {
          await pc.setRemoteDescription(data.description as RTCSessionDescriptionInit);
        }
      });

      socket.on('webrtc:ice', async (data: MeetingSignalPayload) => {
        const pc = connections.current[data.from];
        if (pc && data.candidate) {
          await pc.addIceCandidate(data.candidate as RTCIceCandidateInit);
        }
      });

      socket.emit('meeting:join', meetingId, (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error ?? 'Could not join the meeting');
          setStatus('failed');
          return;
        }
        (result.peers ?? []).forEach((userId) => createConnection(userId, true));
      });
    };

    void start();

    return () => {
      cancelled = true;
      socketRef.current?.emit('meeting:leave', meetingId);
      Object.values(connections.current).forEach((pc) => pc.close());
      connections.current = {};
      localRef.current?.getTracks().forEach((track) => track.stop());
      localRef.current = null;
      setLocalStream(null);
      setPeers({});
      disconnectMeetingSocket();
    };
  }, [enabled, meetingId, createConnection, upsertPeer]);

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  /** Toggle a local track and tell the room. */
  const setTrackEnabled = useCallback(
    (kind: 'audio' | 'video', on: boolean) => {
      localRef.current
        ?.getTracks()
        .filter((t) => t.kind === kind)
        .forEach((t) => {
          t.enabled = on;
        });
      socketRef.current?.emit('meeting:state', {
        meetingId,
        state: { [`${kind}Enabled`]: on }
      });
    },
    [meetingId]
  );

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      const camera = localRef.current?.getVideoTracks()[0];
      if (camera) {
        Object.values(connections.current).forEach((pc) => {
          const trackSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          void trackSender?.replaceTrack(camera);
        });
      }
      socketRef.current?.emit('meeting:state', { meetingId, state: { screenSharing: false } });
    }
  }, [screenStream, meetingId]);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const senderTrack = display.getVideoTracks()[0];
      if (!senderTrack) return null;

      setScreenStream(display);
      setIsScreenSharing(true);

      Object.values(connections.current).forEach((pc) => {
        const trackSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        void trackSender?.replaceTrack(senderTrack);
      });

      const handleEnded = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
        const camera = localRef.current?.getVideoTracks()[0];
        if (camera) {
          Object.values(connections.current).forEach((pc) => {
            const trackSender = pc.getSenders().find((s) => s.track?.kind === 'video');
            void trackSender?.replaceTrack(camera);
          });
        }
        socketRef.current?.emit('meeting:state', { meetingId, state: { screenSharing: false } });
      };

      senderTrack.addEventListener('ended', handleEnded);

      socketRef.current?.emit('meeting:state', { meetingId, state: { screenSharing: true } });
      return display;
    } catch {
      return null;
    }
  }, [meetingId]);

  return {
    localStream,
    peers,
    status,
    error,
    screenStream,
    isScreenSharing,
    setAudioEnabled: (on: boolean) => setTrackEnabled('audio', on),
    setVideoEnabled: (on: boolean) => setTrackEnabled('video', on),
    startScreenShare,
    stopScreenShare,
  };
};
