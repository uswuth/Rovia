import { useCallback, useRef, type MutableRefObject } from 'react';
import type { MeetingSocket } from '@/api/meeting/meeting-socket';
import { buildAudioConstraints, enhanceAudioTrack } from '@/lib/audio-capture';
import { buildCameraConstraints, applySenderBitrate, CAMERA_MAX_BITRATE } from './webrtc-media';

export interface UseMediaControlsProps {
  meetingId: string;
  socketRef: MutableRefObject<MeetingSocket | null>;
  localRef: MutableRefObject<MediaStream | null>;
  screenRef: MutableRefObject<MediaStream | null>;
  connections: MutableRefObject<Record<string, RTCPeerConnection>>;
  screenSenderRef: MutableRefObject<Record<string, RTCRtpSender>>;
  screenTransceiverRef: MutableRefObject<Record<string, RTCRtpTransceiver>>;
  setLocalStream: (s: MediaStream | null) => void;
  setScreenStream: (s: MediaStream | null) => void;
  setIsScreenSharing: (sharing: boolean) => void;
  renegotiateAll: () => Promise<void>;
  sendOffer: (userId: string, pc: RTCPeerConnection) => Promise<void>;
}

export const useMediaControls = ({
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
}: UseMediaControlsProps) => {
  const isScreenSharingRef = useRef(false);

  const setTrackEnabled = useCallback(
    async (kind: 'audio' | 'video', on: boolean) => {
      let tracks = localRef.current?.getTracks().filter((t) => t.kind === kind) ?? [];
      if (kind === 'audio' && on && tracks.length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints() });
          const newAudioTrack = audioStream.getAudioTracks()[0];
          if (newAudioTrack) {
            enhanceAudioTrack(newAudioTrack);
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
      const isSharing = Boolean(screenRef.current);
      socketRef.current?.emit('meeting:state', {
        meetingId,
        state: { [`${kind}Enabled`]: on, isScreenSharing: isSharing }
      });
    },
    [connections, localRef, meetingId, renegotiateAll, screenRef, setLocalStream, socketRef]
  );

  const stopScreenShare = useCallback(async () => {
    if (!screenRef.current) return;
    const screenTracks = screenRef.current.getTracks();
    screenTracks.forEach((track) => track.stop());
    screenRef.current = null;
    isScreenSharingRef.current = false;
    setScreenStream(null);
    setIsScreenSharing(false);

    // Google Meet / Zoom pattern: Stop screen tracks on transceivers without affecting camera transceivers
    for (const [userId, transceiver] of Object.entries(screenTransceiverRef.current)) {
      try {
        if (transceiver.sender) {
          await transceiver.sender.replaceTrack(null);
        }
      } catch {
        // Fallback silently if transceiver is already closed
      }
      delete screenSenderRef.current[userId];
    }

    const cameraTrack = localRef.current?.getVideoTracks()[0] ?? null;
    const cameraOn = Boolean(cameraTrack && cameraTrack.enabled);
    socketRef.current?.emit('meeting:state', {
      meetingId,
      state: { isScreenSharing: false, videoEnabled: cameraOn }
    });
  }, [localRef, meetingId, screenRef, screenSenderRef, screenTransceiverRef, setIsScreenSharing, setScreenStream, socketRef]);

  const startScreenShare = useCallback(async () => {
    try {
      if (screenRef.current) return;
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true
      });
      screenRef.current = displayStream;
      isScreenSharingRef.current = true;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          void stopScreenShare();
        };

        // Attach screen track to each peer's dedicated screen transceiver
        for (const [userId, pc] of Object.entries(connections.current)) {
          let transceiver = screenTransceiverRef.current[userId];
          if (!transceiver || transceiver.direction === 'stopped') {
            try {
              transceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
              screenTransceiverRef.current[userId] = transceiver;
            } catch {
              // Transceiver addition fallback
            }
          }
          if (transceiver?.sender) {
            await transceiver.sender.replaceTrack(videoTrack);
            screenSenderRef.current[userId] = transceiver.sender;
            // Renegotiate cleanly so the remote peer receives the screen track event
            await sendOffer(userId, pc);
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
  }, [connections, localRef, meetingId, screenRef, screenSenderRef, screenTransceiverRef, sendOffer, setIsScreenSharing, setScreenStream, socketRef, stopScreenShare]);

  const toggleScreenShare = useCallback((currentlySharing: boolean) => {
    if (currentlySharing) {
      void stopScreenShare();
    } else {
      void startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

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
        if (kind === 'audio') {
          enhanceAudioTrack(newTrack);
        }

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
    [connections, localRef, setLocalStream]
  );

  return {
    setTrackEnabled,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    switchDevice,
  };
};
