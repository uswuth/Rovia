import { useState, useEffect } from 'react';

export function useMeetingMediaDevices({
  initialMicDeviceId,
  initialCameraDeviceId,
  initialSpeakerDeviceId,
  localStream,
}: {
  initialMicDeviceId?: string;
  initialCameraDeviceId?: string;
  initialSpeakerDeviceId?: string;
  localStream?: MediaStream | null;
}) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>(() => initialMicDeviceId || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(() => initialSpeakerDeviceId || '');
  const [selectedCamera, setSelectedCamera] = useState<string>(() => initialCameraDeviceId || '');

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        const videos = devices.filter((d) => d.kind === 'videoinput');

        setAudioInputs(audios);
        setAudioOutputs(outputs);
        setVideoInputs(videos);

        setSelectedMic((prev) => {
          if (prev && audios.some((d) => d.deviceId === prev)) return prev;
          if (initialMicDeviceId && audios.some((d) => d.deviceId === initialMicDeviceId)) {
            return initialMicDeviceId;
          }
          return audios[0]?.deviceId || 'default';
        });

        setSelectedCamera((prev) => {
          if (prev && videos.some((d) => d.deviceId === prev)) return prev;
          if (initialCameraDeviceId && videos.some((d) => d.deviceId === initialCameraDeviceId)) {
            return initialCameraDeviceId;
          }
          return videos[0]?.deviceId || 'default';
        });

        setSelectedSpeaker((prev) => {
          if (prev && outputs.some((d) => d.deviceId === prev)) return prev;
          if (initialSpeakerDeviceId && outputs.some((d) => d.deviceId === initialSpeakerDeviceId)) {
            return initialSpeakerDeviceId;
          }
          return outputs[0]?.deviceId || 'default';
        });
      } catch {
        // Fallback silently if permission prompt pending
      }
    };

    void fetchDevices();
    navigator.mediaDevices?.addEventListener('devicechange', fetchDevices);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', fetchDevices);
  }, [initialMicDeviceId, initialCameraDeviceId, initialSpeakerDeviceId, localStream]);

  return {
    audioInputs,
    audioOutputs,
    videoInputs,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    selectedCamera,
    setSelectedCamera,
  };
}
