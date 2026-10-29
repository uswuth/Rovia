import { useCallback, useEffect, useRef, useState } from 'react';
import { getMeetingSocket, disconnectMeetingSocket, type MeetingSocket } from '@/api/meeting/meeting-socket';
import type { MeetingSignalPayload } from '@/api/meeting/webrtc.types';
import { buildAudioConstraints } from '@/lib/audio-capture';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const CAMERA_MAX_BITRATE = 3_000_000;

export const buildCameraConstraints = (deviceId?: string, exactDevice = false): MediaTrackConstraints => ({
  deviceId: deviceId && deviceId !== 'default' ? (exactDevice ? { exact: deviceId } : { ideal: deviceId }) : undefined,
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
});

const applySenderBitrate = async (sender: RTCRtpSender, maxBitrate: number) => {
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

const applyBitratesToConnection = (pc: RTCPeerConnection) => {
  const videoSender = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video')?.sender;
  if (videoSender) {
    void applySenderBitrate(videoSender, CAMERA_MAX_BITRATE);
  }
};

export interface PeerState {
  userId: string;
  /** The remote MediaStream (camera/audio), ready to attach to a <video> element. */
  stream: MediaStream | null;
  screenStream?: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
}

/** Peer-to-peer mesh: the server only relays SDP/ICE, and the joining peer always offers. */
export const useWebRtcMeeting = (
  meetingId: string,
  enabled: boolean,
  options?: {
    visitorId?: string;
    initialAudioDeviceId?: string;
    initialVideoDeviceId?: string;
    initialMic?: boolean;
    initialCamera?: boolean;
    onPeerLeft?: (userId: string) => void;
    onPeerJoined?: (userId: string) => void;
  }
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
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      connections.current[userId] = pc;
      if (!iceCandidatesQueue.current[userId]) {
        iceCandidatesQueue.current[userId] = [];
      }

      if (localRef.current) {
        localRef.current.getTracks().forEach((track) => pc.addTrack(track, localRef.current as MediaStream));
      }
      if (screenRef.current) {
        screenRef.current.getTracks().forEach((track) => pc.addTrack(track, screenRef.current as MediaStream));
      }

      const senders = pc.getSenders();
      if (!senders.some((s) => s.track?.kind === 'audio')) {
        try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch {
          // Transceiver might already exist or not supported
        }
      }
      // Ensure at least 2 video transceivers exist (Slot 1: Camera, Slot 2: Screen share)
      const videoTransceivers = pc.getTransceivers().filter((t) => t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video');
      const requiredVideoTransceivers = 2;
      for (let i = videoTransceivers.length; i < requiredVideoTransceivers; i++) {
        try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch {
          // Transceiver might already exist or not supported
        }
      }
      applyBitratesToConnection(pc);

      const remoteCamera = new MediaStream();
      const remoteScreen = new MediaStream();
      upsertPeer(userId, { stream: remoteCamera, screenStream: remoteScreen });

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;

        if (track.kind === 'video') {
          // If remoteCamera already has a video track and a second video track arrives, that second track is the screen share
          const hasCameraVideo = remoteCamera.getVideoTracks().length > 0;
          const isExplicitScreen =
            track.label?.toLowerCase().includes('screen') ||
            event.streams?.some((s) => s.id?.toLowerCase().includes('screen'));

          if (hasCameraVideo || isExplicitScreen) {
            // Belongs to screenStream
            if (!remoteScreen.getTracks().some((t) => t.id === track.id)) {
              remoteScreen.addTrack(track);
            }
            track.onended = () => {
              remoteScreen.removeTrack(track);
              upsertPeer(userId, {
                screenStream: new MediaStream(remoteScreen.getTracks()),
                isScreenSharing: remoteScreen.getVideoTracks().length > 0,
              });
            };
            upsertPeer(userId, {
              screenStream: new MediaStream(remoteScreen.getTracks()),
              isScreenSharing: true,
            });
          } else {
            // Belongs to remoteCamera
            if (!remoteCamera.getTracks().some((t) => t.id === track.id)) {
              remoteCamera.addTrack(track);
            }
            track.onended = () => {
              remoteCamera.removeTrack(track);
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
            remoteCamera.removeTrack(track);
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
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
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
        setLocalStream(stream);
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: buildCameraConstraints(), audio: audioConstraint });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localRef.current = stream;
          setLocalStream(stream);
        } catch {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
            if (cancelled) {
              audioStream.getTracks().forEach((t) => t.stop());
              return;
            }
            localRef.current = audioStream;
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
        const pc = createConnection(userId, false);
        upsertPeer(userId, {});
        onPeerJoinedRef.current?.(userId);

        if (screenRef.current) {
          const screenVideoTrack = screenRef.current.getVideoTracks()[0];
          if (screenVideoTrack && !pc.getSenders().some((s) => s.track === screenVideoTrack)) {
            pc.addTrack(screenVideoTrack, screenRef.current);
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
        delete iceCandidatesQueue.current[userId];
        setPeers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        onPeerLeftRef.current?.(userId);
      });

      socket.on('meeting:state', ({ userId, state }) => {
        const patch: { audioEnabled?: boolean; videoEnabled?: boolean; isScreenSharing?: boolean; stream?: MediaStream | null; screenStream?: MediaStream } = {};
        if (typeof state.audioEnabled === 'boolean') patch.audioEnabled = state.audioEnabled;
        if (typeof state.videoEnabled === 'boolean') patch.videoEnabled = state.videoEnabled;
        if (typeof state.isScreenSharing === 'boolean') {
          patch.isScreenSharing = state.isScreenSharing;
        }
        if (Object.keys(patch).length > 0) upsertPeer(userId, patch);
      });

      socket.on('webrtc:offer', async (data: MeetingSignalPayload) => {
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
        (result.peers ?? []).forEach((userId) => createConnection(userId, true));
      });
    };

    void start();

    return () => {
      cancelled = true;
      if (joinTimer !== undefined) window.clearTimeout(joinTimer);
      socketRef.current?.emit('meeting:leave', meetingId);
      Object.values(connections.current).forEach((pc) => pc.close());
      connections.current = {};
      iceCandidatesQueue.current = {};
      localRef.current?.getTracks().forEach((track) => track.stop());
      localRef.current = null;
      screenRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setIsScreenSharing(false);
      setPeers({});
      disconnectMeetingSocket();
    };
  }, [enabled, meetingId, createConnection, upsertPeer, options?.visitorId]);

  /** Toggle a local track and tell the room. */
  const setTrackEnabled = useCallback(
    async (kind: 'audio' | 'video', on: boolean) => {
      let tracks = localRef.current?.getTracks().filter((t) => t.kind === kind) ?? [];
      if (kind === 'audio' && on && tracks.length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
          const newAudioTrack = audioStream.getAudioTracks()[0];
          if (newAudioTrack) {
            if (!localRef.current) {
              localRef.current = new MediaStream();
            }
            localRef.current.addTrack(newAudioTrack);
            for (const pc of Object.values(connections.current)) {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
              if (sender) {
                await sender.replaceTrack(newAudioTrack);
              } else if (localRef.current) {
                pc.addTrack(newAudioTrack, localRef.current);
              }
            }
            setLocalStream(new MediaStream(localRef.current.getTracks()));
            tracks = [newAudioTrack];
            void renegotiateAll();
          }
        } catch (err) {
          console.warn('Failed to dynamically acquire audio track:', err);
        }
      }
      if (kind === 'video' && on && tracks.length === 0) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: buildCameraConstraints() });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          if (newVideoTrack) {
            if (!localRef.current) {
              localRef.current = new MediaStream();
            }
            localRef.current.addTrack(newVideoTrack);
            for (const pc of Object.values(connections.current)) {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                await sender.replaceTrack(newVideoTrack);
                void applySenderBitrate(sender, CAMERA_MAX_BITRATE);
              } else if (localRef.current) {
                const newSender = pc.addTrack(newVideoTrack, localRef.current);
                void applySenderBitrate(newSender, CAMERA_MAX_BITRATE);
              }
            }
            setLocalStream(new MediaStream(localRef.current.getTracks()));
            tracks = [newVideoTrack];
            void renegotiateAll();
          }
        } catch (err) {
          console.warn('Failed to dynamically acquire video track:', err);
        }
      }
      tracks.forEach((t) => {
        t.enabled = on;
      });
      socketRef.current?.emit('meeting:state', {
        meetingId,
        state: { [`${kind}Enabled`]: on }
      });
    },
    [meetingId, renegotiateAll]
  );

  const stopScreenShare = useCallback(async () => {
    if (!screenRef.current) return;
    const screenTracks = screenRef.current.getTracks();
    screenTracks.forEach((track) => track.stop());
    screenRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);

    const cameraTrack = localRef.current?.getVideoTracks()[0] ?? null;
    for (const [userId, pc] of Object.entries(connections.current)) {
      const senders = pc.getSenders();
      const screenSender = senders.find((s) => screenTracks.includes(s.track!));
      if (screenSender) {
        pc.removeTrack(screenSender);
        await sendOffer(userId, pc);
      } else {
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }
      }
    }

    const cameraOn = Boolean(cameraTrack && cameraTrack.enabled);
    socketRef.current?.emit('meeting:state', {
      meetingId,
      state: { isScreenSharing: false, videoEnabled: cameraOn }
    });
  }, [meetingId, sendOffer]);

  const startScreenShare = useCallback(async () => {
    try {
      if (screenRef.current) return;
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true
      });
      screenRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };

        for (const [userId, pc] of Object.entries(connections.current)) {
          // If local camera track already exists, add screen as an additional track so both stream concurrently
          const existingSenders = pc.getSenders();
          const cameraSender = existingSenders.find((s) => s.track === localRef.current?.getVideoTracks()[0]);
          if (cameraSender) {
            pc.addTrack(videoTrack, displayStream);
            await sendOffer(userId, pc);
          } else {
            const videoSender = existingSenders.find((s) => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, displayStream);
              await sendOffer(userId, pc);
            }
          }
        }
      }

      const cameraOn = Boolean(localRef.current?.getVideoTracks().some((t) => t.enabled));
      socketRef.current?.emit('meeting:state', {
        meetingId,
        state: { isScreenSharing: true, videoEnabled: cameraOn }
      });
    } catch (err) {
      console.warn('Screen share canceled or denied:', err);
    }
  }, [meetingId, sendOffer, stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      void stopScreenShare();
    } else {
      void startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      try {
        const getStreamForDevice = async (constraint: boolean | MediaTrackConstraints) => {
          const audio = kind === 'audio' ? buildAudioConstraints(deviceId) : false;
          return navigator.mediaDevices.getUserMedia(
            kind === 'video'
              ? { video: constraint, audio: false }
              : { audio, video: false }
          );
        };

        let newStream: MediaStream;
        if (!deviceId || deviceId === 'default') {
          newStream = await getStreamForDevice(kind === 'video' ? buildCameraConstraints() : true);
        } else {
          try {
            newStream = await getStreamForDevice(
              kind === 'video' ? buildCameraConstraints(deviceId, true) : { deviceId: { exact: deviceId } }
            );
          } catch {
            newStream = await getStreamForDevice(
              kind === 'video' ? buildCameraConstraints(deviceId, false) : { deviceId: { ideal: deviceId } }
            );
          }
        }

        const newTrack = kind === 'video' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
        if (!newTrack) return;

        if (!localRef.current) {
          localRef.current = new MediaStream();
        }

        const replacementTrack = newTrack;
        const oldTrack = kind === 'video' ? localRef.current.getVideoTracks()[0] : localRef.current.getAudioTracks()[0];
        if (oldTrack) {
          replacementTrack.enabled = oldTrack.enabled;
          localRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localRef.current.addTrack(replacementTrack);

        for (const pc of Object.values(connections.current)) {
          const transceiver = pc.getTransceivers?.().find(
            (t) => t.sender.track?.kind === kind || t.receiver.track?.kind === kind
          );
          if (transceiver?.sender) {
            await transceiver.sender.replaceTrack(replacementTrack);
            if (kind === 'video') void applySenderBitrate(transceiver.sender, CAMERA_MAX_BITRATE);
            continue;
          }
          const sender = pc.getSenders().find((s) => s.track?.kind === kind);
          if (sender) {
            await sender.replaceTrack(replacementTrack);
            if (kind === 'video') void applySenderBitrate(sender, CAMERA_MAX_BITRATE);
          } else if (localRef.current) {
            const newSender = pc.addTrack(replacementTrack, localRef.current);
            if (kind === 'video') void applySenderBitrate(newSender, CAMERA_MAX_BITRATE);
          }
        }

        setLocalStream(new MediaStream(localRef.current.getTracks()));
      } catch (err) {
        console.warn(`Failed to switch ${kind} device:`, err);
      }
    },
    []
  );

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
    toggleScreenShare,
    switchMicrophone: (deviceId: string) => switchDevice('audio', deviceId),
    switchCamera: (deviceId: string) => switchDevice('video', deviceId),
  };
};
