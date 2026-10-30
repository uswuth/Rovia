import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeetingSocket, disconnectMeetingSocket, type MeetingSocket } from '@/api/meeting/meeting-socket';
import type { MeetingSignalPayload } from '@/api/meeting/webrtc.types';
import { buildAudioConstraints, enhanceAudioTrack } from '@/lib/audio-capture';
import type { PeerState, UseWebRtcMeetingOptions } from './webrtc/types';
import { ICE_SERVERS, buildCameraConstraints, applyBitratesToConnection } from './webrtc/webrtc-media';
import { useMediaControls } from './webrtc/useMediaControls';

export type { PeerState, UseWebRtcMeetingOptions } from './webrtc/types';
export { buildCameraConstraints } from './webrtc/webrtc-media';

/** Peer-to-peer mesh: the server only relays SDP/ICE, and the joining peer always offers. */
export const useWebRtcMeeting = (
  meetingId: string,
  enabled: boolean,
  options?: UseWebRtcMeetingOptions
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [peers, setPeers] = useState<Record<string, PeerState>>({});
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<MeetingSocket | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const connections = useRef<Record<string, RTCPeerConnection>>({});
  const iceCandidatesQueue = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const peersRef = useRef<Record<string, PeerState>>({});
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  const onPeerLeftRef = useRef(options?.onPeerLeft);
  const onPeerJoinedRef = useRef(options?.onPeerJoined);
  const initialSettingsRef = useRef({
    visitorId: options?.visitorId,
    initialAudioDeviceId: options?.initialAudioDeviceId,
    initialVideoDeviceId: options?.initialVideoDeviceId,
    initialMic: options?.initialMic,
    initialCamera: options?.initialCamera,
  });
  useEffect(() => {
    onPeerLeftRef.current = options?.onPeerLeft;
    onPeerJoinedRef.current = options?.onPeerJoined;
  }, [options?.onPeerLeft, options?.onPeerJoined]);

  const upsertPeer = useCallback((userId: string, patch: Partial<PeerState>) => {
    setPeers((prev) => ({
      ...prev,
      [userId]: {
        userId,
        stream: patch.stream !== undefined ? patch.stream : (prev[userId]?.stream ?? null),
        audioEnabled: patch.audioEnabled !== undefined ? patch.audioEnabled : (prev[userId]?.audioEnabled ?? true),
        videoEnabled: patch.videoEnabled !== undefined ? patch.videoEnabled : (prev[userId]?.videoEnabled ?? true),
        ...patch
      }
    }));
  }, []);

  const makingOfferRef = useRef<Record<string, boolean>>({});
  const screenSenderRef = useRef<Record<string, RTCRtpSender>>({});
  const screenTransceiverRef = useRef<Record<string, RTCRtpTransceiver>>({});
  const sendOfferRef = useRef<((userId: string, pc: RTCPeerConnection) => Promise<void>) | null>(null);

  const sendOffer = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    try {
      if (pc.signalingState !== 'stable' || makingOfferRef.current[userId]) {
        // Wait for connection to return to stable before retrying renegotiation
        const handleStateChange = async () => {
          if (pc.signalingState === 'stable') {
            pc.removeEventListener('signalingstatechange', handleStateChange);
            await sendOfferRef.current?.(userId, pc);
          }
        };
        pc.addEventListener('signalingstatechange', handleStateChange);
        return;
      }
      makingOfferRef.current[userId] = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc:offer', { meetingId, to: userId, description: offer });
    } catch (err) {
      console.warn('Failed to send WebRTC offer:', err);
    } finally {
      makingOfferRef.current[userId] = false;
    }
  }, [meetingId]);

  useEffect(() => {
    sendOfferRef.current = sendOffer;
  }, [sendOffer]);

  const renegotiateAll = useCallback(async () => {
    for (const [userId, pc] of Object.entries(connections.current)) {
      await sendOffer(userId, pc);
    }
  }, [sendOffer]);

  const createConnection = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      const existing = connections.current[userId];
      if (existing && existing.connectionState !== 'closed' && existing.signalingState !== 'closed') {
        return existing;
      }
      if (existing) {
        try {
          existing.close();
        } catch {
          // Ignore connection close errors
        }
        delete connections.current[userId];
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
      connections.current[userId] = pc;
      if (!iceCandidatesQueue.current[userId]) {
        iceCandidatesQueue.current[userId] = [];
      }

      // Dedicated MediaStream references per peer
      const remoteCamera = new MediaStream();
      const remoteScreen = new MediaStream();
      upsertPeer(userId, { stream: remoteCamera, screenStream: remoteScreen });

      // Add local audio and video (camera) tracks
      if (localRef.current) {
        localRef.current.getTracks().forEach((track) => pc.addTrack(track, localRef.current as MediaStream));
      }

      // Add camera transceivers if needed
      const senders = pc.getSenders();
      if (!senders.some((s) => s.track?.kind === 'audio')) {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {
          // Transceiver might already exist
        }
      }
      if (!senders.some((s) => s.track?.kind === 'video')) {
        try {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch {
          // Transceiver might already exist
        }
      }

      // Separate dedicated transceiver for screen share (sendrecv so both peers can send/receive screen)
      try {
        const screenTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
        screenTransceiverRef.current[userId] = screenTransceiver;
        if (screenRef.current) {
          const screenTrack = screenRef.current.getVideoTracks()[0];
          if (screenTrack) {
            void screenTransceiver.sender.replaceTrack(screenTrack);
            screenSenderRef.current[userId] = screenTransceiver.sender;
          }
        }
      } catch {
        // Transceiver setup fallback
      }

      applyBitratesToConnection(pc);

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;

        if (track.kind === 'video') {
          // Explicit stream identification (e.g. stream ID contains 'screen' or track label contains 'screen')
          const isExplicitScreen =
            track.label?.toLowerCase().includes('screen') ||
            event.streams?.some((s) => s.id?.toLowerCase().includes('screen'));

          // Slot determination: If remoteCamera already has a video track and a second video track arrives, that second is the screen share
          const hasCameraVideo = remoteCamera.getVideoTracks().length > 0;

          if (isExplicitScreen || (hasCameraVideo && !remoteCamera.getTracks().some((t) => t.id === track.id))) {
            // Dedicated Screen Stream
            if (!remoteScreen.getTracks().some((t) => t.id === track.id)) {
              remoteScreen.addTrack(track);
            }
            track.onended = () => {
              try {
                remoteScreen.removeTrack(track);
              } catch {
                // Ignore removal error
              }
              upsertPeer(userId, {
                screenStream: new MediaStream(remoteScreen.getTracks()),
                isScreenSharing: false,
              });
            };
            upsertPeer(userId, {
              screenStream: new MediaStream(remoteScreen.getTracks()),
              isScreenSharing: true,
            });
          } else {
            // Dedicated Camera Stream
            if (!remoteCamera.getTracks().some((t) => t.id === track.id)) {
              remoteCamera.addTrack(track);
            }
            track.onended = () => {
              try {
                remoteCamera.removeTrack(track);
              } catch {
                // Ignore removal error
              }
              upsertPeer(userId, { stream: new MediaStream(remoteCamera.getTracks()) });
            };
            upsertPeer(userId, { stream: new MediaStream(remoteCamera.getTracks()) });
          }
        } else {
          // Audio track
          if (!remoteCamera.getTracks().some((t) => t.id === track.id)) {
            remoteCamera.addTrack(track);
          }
          track.onended = () => {
            try {
              remoteCamera.removeTrack(track);
            } catch {
              // Ignore removal error
            }
            upsertPeer(userId, { stream: new MediaStream(remoteCamera.getTracks()) });
          };
          upsertPeer(userId, { stream: new MediaStream(remoteCamera.getTracks()) });
        }
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
        if (pc.connectionState === 'connected') {
          setStatus('connected');
          applyBitratesToConnection(pc);
        }
        if (['failed', 'closed'].includes(pc.connectionState)) {
          connections.current[userId]?.close();
          delete connections.current[userId];
          delete iceCandidatesQueue.current[userId];
          setPeers((prev) => {
            if (!prev[userId]) return prev;
            const next = { ...prev };
            delete next[userId];
            return next;
          });
          onPeerLeftRef.current?.(userId);
        }
      };

      if (initiator) {
        void sendOffer(userId, pc);
      }

      return pc;
    },
    [meetingId, upsertPeer, sendOffer]
  );

  useEffect(() => {
    if (!enabled || !meetingId) return undefined;

    let cancelled = false;
    let joinTimer: number | undefined;
    let joinTimedOut = false;

    const start = async () => {
      setStatus('connecting');
      const settings = initialSettingsRef.current;
      const audioConstraint = buildAudioConstraints(settings.initialAudioDeviceId);
      const videoConstraint = buildCameraConstraints(settings.initialVideoDeviceId);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: audioConstraint });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        stream.getAudioTracks().forEach(enhanceAudioTrack);
        setLocalStream(stream);
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: buildCameraConstraints(), audio: audioConstraint });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localRef.current = stream;
          stream.getAudioTracks().forEach(enhanceAudioTrack);
          setLocalStream(stream);
        } catch {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
            if (cancelled) {
              audioStream.getTracks().forEach((t) => t.stop());
              return;
            }
            localRef.current = audioStream;
            audioStream.getAudioTracks().forEach(enhanceAudioTrack);
            setLocalStream(audioStream);
          } catch {
            const emptyStream = new MediaStream();
            localRef.current = emptyStream;
            setLocalStream(emptyStream);
          }
        }
      }

      if (localRef.current) {
        if (settings.initialMic === false) {
          localRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
        }
        if (settings.initialCamera === false) {
          localRef.current.getVideoTracks().forEach((t) => { t.enabled = false; });
        }
      }

      if (localRef.current) {
        const currentStream = localRef.current;
        Object.values(connections.current).forEach((pc) => {
          currentStream.getTracks().forEach((track) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
            if (sender) {
              void sender.replaceTrack(track);
            } else {
              pc.addTrack(track, currentStream);
            }
          });
          applyBitratesToConnection(pc);
        });
      }

      const socket = getMeetingSocket(options?.visitorId);
      socketRef.current = socket;

      socket.on('meeting:peer-joined', ({ userId }) => {
        // Clean up any lingering previous connection for this peer before recreating
        if (connections.current[userId]) {
          try {
            connections.current[userId].close();
          } catch {
            // Ignore connection close errors
          }
          delete connections.current[userId];
        }
        createConnection(userId, false);
        upsertPeer(userId, {});
        onPeerJoinedRef.current?.(userId);

        if (screenRef.current) {
          const screenVideoTrack = screenRef.current.getVideoTracks()[0];
          const transceiver = screenTransceiverRef.current[userId];
          if (screenVideoTrack && transceiver?.sender) {
            void transceiver.sender.replaceTrack(screenVideoTrack);
            screenSenderRef.current[userId] = transceiver.sender;
          }
        }

        const currentMic = localRef.current?.getAudioTracks().some((t) => t.enabled) ?? true;
        const currentCam = localRef.current?.getVideoTracks().some((t) => t.enabled) ?? true;
        const isSharing = Boolean(screenRef.current);
        socket.emit('meeting:state', {
          meetingId,
          state: {
            audioEnabled: currentMic,
            videoEnabled: currentCam,
            isScreenSharing: isSharing
          }
        });
      });

      socket.on('meeting:peer-left', ({ userId }) => {
        connections.current[userId]?.close();
        delete connections.current[userId];
        delete screenTransceiverRef.current[userId];
        delete screenSenderRef.current[userId];
        delete iceCandidatesQueue.current[userId];
        setPeers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        onPeerLeftRef.current?.(userId);
      });

      socket.on('meeting:state', ({ userId, state }) => {
        const patch: { audioEnabled?: boolean; videoEnabled?: boolean; isScreenSharing?: boolean; stream?: MediaStream | null; screenStream?: MediaStream | null } = {};
        if (typeof state.audioEnabled === 'boolean') patch.audioEnabled = state.audioEnabled;
        if (typeof state.videoEnabled === 'boolean') patch.videoEnabled = state.videoEnabled;
        if (typeof state.isScreenSharing === 'boolean') {
          patch.isScreenSharing = state.isScreenSharing;
          if (!state.isScreenSharing) {
            patch.screenStream = null;
          }
        }
        if (Object.keys(patch).length > 0) upsertPeer(userId, patch);
      });

      socket.on('webrtc:offer', async (data: MeetingSignalPayload) => {
        // If an offer arrives and the existing connection is closed or in a bad state, clean it up
        const existingPc = connections.current[data.from];
        if (existingPc && (existingPc.connectionState === 'closed' || existingPc.signalingState === 'closed')) {
          try {
            existingPc.close();
          } catch {
            // Ignore connection close errors
          }
          delete connections.current[data.from];
        }
        const pc = createConnection(data.from, false);
        if (data.description) {
          // If in have-local-offer (both peers offered simultaneously), rollback to accept the remote offer
          if (pc.signalingState !== 'stable') {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
              pc.setRemoteDescription(data.description as RTCSessionDescriptionInit)
            ]).catch(() => {});
          } else {
            await pc.setRemoteDescription(data.description as RTCSessionDescriptionInit);
          }

          const queue = iceCandidatesQueue.current[data.from] || [];
          while (queue.length > 0) {
            const candidate = queue.shift();
            if (candidate) await pc.addIceCandidate(candidate).catch(() => {});
          }
        }
        if (pc.signalingState === 'have-remote-offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:answer', { meetingId, to: data.from, description: answer });
        }
      });

      socket.on('webrtc:answer', async (data: MeetingSignalPayload) => {
        const pc = connections.current[data.from];
        if (pc && data.description) {
          // An answer is valid only when we have created a local offer (have-local-offer)
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(data.description as RTCSessionDescriptionInit).catch((err) => {
              console.warn('Failed to set remote answer description:', err);
            });
            const queue = iceCandidatesQueue.current[data.from] || [];
            while (queue.length > 0) {
              const candidate = queue.shift();
              if (candidate) await pc.addIceCandidate(candidate).catch(() => {});
            }
          }
        }
      });

      socket.on('webrtc:ice', async (data: MeetingSignalPayload) => {
        const pc = connections.current[data.from];
        if (data.candidate) {
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(data.candidate as RTCIceCandidateInit).catch(() => {});
          } else {
            if (!iceCandidatesQueue.current[data.from]) {
              iceCandidatesQueue.current[data.from] = [];
            }
            iceCandidatesQueue.current[data.from].push(data.candidate as RTCIceCandidateInit);
          }
        }
      });

      joinTimer = window.setTimeout(() => {
        if (cancelled) return;
        joinTimedOut = true;
        setError('Could not join the meeting: the server did not respond');
        setStatus('failed');
      }, 10000);

      socket.emit('meeting:join', meetingId, (result) => {
        if (cancelled) return;
        if (joinTimer !== undefined) window.clearTimeout(joinTimer);
        if (joinTimedOut) {
          joinTimedOut = false;
          setError(null);
          if (result.ok) setStatus('connecting');
        }
        if (!result.ok) {
          setError(result.error ?? 'Could not join the meeting');
          setStatus('failed');
          return;
        }
        (result.peers ?? []).forEach((userId) => {
          upsertPeer(userId, {});
          createConnection(userId, true);
          onPeerJoinedRef.current?.(userId);
        });

        // Broadcast current audio/video state so newly joined room peers immediately know whether our mic and camera are active
        const currentMic = localRef.current?.getAudioTracks().some((t) => t.enabled) ?? true;
        const currentCam = localRef.current?.getVideoTracks().some((t) => t.enabled) ?? true;
        const isSharing = Boolean(screenRef.current);
        socket.emit('meeting:state', {
          meetingId,
          state: {
            audioEnabled: currentMic,
            videoEnabled: currentCam,
            isScreenSharing: isSharing
          }
        });
      });
    };

    void start();

    return () => {
      cancelled = true;
      if (joinTimer !== undefined) window.clearTimeout(joinTimer);
      if (screenRef.current) {
        screenRef.current.getTracks().forEach((track) => track.stop());
        screenRef.current = null;
      }
      socketRef.current?.emit('meeting:state', {
        meetingId,
        state: { isScreenSharing: false }
      });
      socketRef.current?.emit('meeting:leave', meetingId);
      Object.values(connections.current).forEach((pc) => pc.close());
      connections.current = {};
      screenTransceiverRef.current = {};
      screenSenderRef.current = {};
      iceCandidatesQueue.current = {};
      localRef.current?.getTracks().forEach((track) => track.stop());
      localRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setIsScreenSharing(false);
      setPeers({});
      disconnectMeetingSocket();
    };
  }, [enabled, meetingId, createConnection, upsertPeer, options?.visitorId]);

  const {
    setTrackEnabled,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    switchDevice,
  } = useMediaControls({
    meetingId,
    socketRef,
    localRef,
    screenRef,
    connections,
    screenSenderRef,
    screenTransceiverRef,
    setLocalStream,
    setScreenStream,
    setIsScreenSharing,
    renegotiateAll,
    sendOffer,
  });

  return {
    localStream,
    screenStream,
    isScreenSharing,
    peers,
    status,
    error,
    setAudioEnabled: (on: boolean) => setTrackEnabled('audio', on),
    setVideoEnabled: (on: boolean) => setTrackEnabled('video', on),
    startScreenShare,
    stopScreenShare,
    toggleScreenShare: () => toggleScreenShare(isScreenSharing),
    switchMicrophone: (deviceId: string) => switchDevice('audio', deviceId),
    switchCamera: (deviceId: string) => switchDevice('video', deviceId),
  };
};
