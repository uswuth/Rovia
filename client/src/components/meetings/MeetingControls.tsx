import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume1,
  Volume2,
  VolumeX,
  Check,
  PhoneOff,
  Hand,
  Settings,
  ChevronUp,
  ChevronDown,
  Radio,
  Sparkles,
  Maximize2,
  Minimize2,
  Play,
  X,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  ScreenShare,
  ScreenShareOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { buildAudioConstraints } from '@/lib/audio-capture';
import { useTheme } from '@/context/theme-context';
import { PANELS, type PanelKey } from './meetingPanels';

export type { PanelKey };

const getCleanDeviceLabel = (
  device: MediaDeviceInfo | undefined,
  type: 'Microphone' | 'Camera' | 'Speaker',
  index: number
): string => {
  if (!device) return `Default ${type}`;
  if (device.label && device.label.trim()) return device.label.trim();
  if (device.deviceId === 'default') return `Default ${type}`;
  return `${type} ${index >= 0 ? index + 1 : 1}`;
};

export interface MeetingControlsProps {
  localStream?: MediaStream | null;

  // Recording & AI Summary
  isRecording: boolean;
  onToggleRecording: () => void;
  /** Records where the AI pipeline is: Recording, Uploading or Processing. */
  recordingStage?: 'idle' | 'recording' | 'uploading' | 'processing' | 'ready' | 'failed';
  /** mm:ss of captured audio, shown only while recording. */
  recordingElapsedMs?: number;
  showRecordModal: boolean;
  setShowRecordModal: (open: boolean) => void;
  aiSummaryEnabled: boolean;
  setAiSummaryEnabled: (enabled: boolean) => void;
  canManage: boolean;
  meetingId?: string;

  // Audio / Mic
  micOn: boolean;
  onToggleMic: () => void;
  audioInputs: MediaDeviceInfo[];
  selectedMic: string;
  onSelectMic: (deviceId: string) => void;

  // Speaker
  speakerOn: boolean;
  onToggleSpeaker: () => void;
  audioOutputs: MediaDeviceInfo[];
  selectedSpeaker: string;
  onSelectSpeaker: (deviceId: string) => void;

  // Video / Camera
  cameraOn: boolean;
  onToggleCamera: () => void;
  videoInputs: MediaDeviceInfo[];
  selectedCamera: string;
  onSelectCamera: (deviceId: string) => void;

  // Screen Share
  isScreenSharing?: boolean;
  onToggleScreenShare?: () => void;

  // Hand
  handRaised: boolean;
  onToggleHandRaise: () => void;

  // Fullscreen & Leave
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLeaveClick: () => void;

  // Panels & View settings
  panel: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (open: boolean) => void;
}

/** Bottom toolbar controls dock for in-meeting actions */
export const MeetingControls: React.FC<MeetingControlsProps> = ({
  localStream,
  isRecording,
  onToggleRecording,
  recordingStage = 'idle',
  recordingElapsedMs = 0,
  showRecordModal,
  setShowRecordModal,
  aiSummaryEnabled,
  setAiSummaryEnabled,
  canManage,
  meetingId,
  micOn,
  onToggleMic,
  audioInputs,
  selectedMic,
  onSelectMic,
  speakerOn,
  onToggleSpeaker,
  audioOutputs,
  selectedSpeaker,
  onSelectSpeaker,
  cameraOn,
  onToggleCamera,
  videoInputs,
  selectedCamera,
  onSelectCamera,
  isScreenSharing = false,
  onToggleScreenShare,
  handRaised,
  onToggleHandRaise,
  isFullscreen,
  onToggleFullscreen,
  onLeaveClick,
  panel,
  onSelectPanel,
  showSettingsModal,
  setShowSettingsModal,
}) => {
  const { theme, setTheme } = useTheme();
  const [activeShelf, setActiveShelf] = useState<'mic' | 'camera' | 'speaker' | null>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(100);
  const [speakerVolume, setSpeakerVolume] = useState<number>(100);
  const [liveMicLevel, setLiveMicLevel] = useState<number>(0);
  const [liveSpeakerLevel, setLiveSpeakerLevel] = useState<number>(0);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState<boolean>(false);
  const [micTestStage, setMicTestStage] = useState<'idle' | 'countdown' | 'recording' | 'ready_to_play' | 'playing' | 'done'>('idle');
  const [micCountdown, setMicCountdown] = useState<number>(3);
  const micCountdownTimerRef = useRef<number | null>(null);
  const micAudioUrlRef = useRef<string | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(null);

  // The recorder button reports pipeline progress, so the user is never left
  // guessing whether "Stop Recording" actually saved anything.
  const recordingStageLabel =
    recordingStage === 'recording'
      ? 'Recording'
      : recordingStage === 'uploading'
        ? 'Uploading'
        : recordingStage === 'processing'
          ? 'Processing'
          : recordingStage === 'failed'
            ? 'Failed'
            : 'Record';

  const recordingElapsedLabel = React.useMemo(() => {
    if (recordingStage !== 'recording' || recordingElapsedMs <= 0) return '';
    const totalSeconds = Math.floor(recordingElapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [recordingStage, recordingElapsedMs]);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [isTestingCamera, setIsTestingCamera] = useState<boolean>(false);

  const handleToggleShelf = (shelf: 'mic' | 'camera' | 'speaker') => {
    setActiveShelf((prev) => {
      const next = prev === shelf ? null : shelf;
      if (next !== 'camera') {
        setIsTestingCamera(false);
      }
      return next;
    });
  };

  const currentMicIndex = audioInputs.findIndex((d) => d.deviceId === selectedMic);
  const currentMicDevice = audioInputs.find((d) => d.deviceId === selectedMic || (!selectedMic && d.deviceId === 'default'));
  const currentMicLabel = getCleanDeviceLabel(currentMicDevice || audioInputs[0], 'Microphone', currentMicIndex >= 0 ? currentMicIndex : 0);

  const currentSpeakerIndex = audioOutputs.findIndex((d) => d.deviceId === selectedSpeaker);
  const currentSpeakerDevice = audioOutputs.find((d) => d.deviceId === selectedSpeaker || (!selectedSpeaker && d.deviceId === 'default'));
  const currentSpeakerLabel = getCleanDeviceLabel(currentSpeakerDevice || audioOutputs[0], 'Speaker', currentSpeakerIndex >= 0 ? currentSpeakerIndex : 0);

  const currentCameraIndex = videoInputs.findIndex((d) => d.deviceId === selectedCamera);
  const currentCameraDevice = videoInputs.find((d) => d.deviceId === selectedCamera || (!selectedCamera && d.deviceId === 'default'));
  const currentCameraLabel = getCleanDeviceLabel(currentCameraDevice || videoInputs[0], 'Camera', currentCameraIndex >= 0 ? currentCameraIndex : 0);

  // Real-time microphone input metering attached to the selected mic device
  useEffect(() => {
    if (activeShelf !== 'mic' || !micOn) {
      return;
    }

    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let isCancelled = false;

    const startMetering = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: buildAudioConstraints(selectedMic),
          video: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

        const updateLevel = () => {
          if (isCancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100 * (micVolume / 100)));
          setLiveMicLevel(level);
          animId = requestAnimationFrame(updateLevel);
        };
        animId = requestAnimationFrame(updateLevel);
      } catch {
        setLiveMicLevel(0);
      }
    };

    void startMetering();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => { });
      }
    };
  }, [activeShelf, selectedMic, micOn, micVolume]);

  // Real-time camera preview stream for the video settings shelf:
  // ONLY runs when user explicitly clicks the "Test Live Preview" button!
  useEffect(() => {
    if (activeShelf !== 'camera' || !isTestingCamera) {
      return;
    }

    let isCancelled = false;
    let localTempStream: MediaStream | null = null;

    const startCamera = async () => {
      // If localStream from WebRTC already has a live video track matching current camera, use it directly
      const hasLiveLocalVideo =
        cameraOn &&
        Boolean(localStream) &&
        localStream!.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled !== false);

      if (hasLiveLocalVideo && localStream) {
        if (!isCancelled) {
          setPreviewStream(localStream);
          setIsCameraLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setIsCameraLoading(true);
        setCameraPreviewError(null);
      }

      try {
        const constraints: MediaStreamConstraints = {
          video:
            selectedCamera && selectedCamera !== 'default'
              ? { deviceId: { exact: selectedCamera }, width: { ideal: 640 }, height: { ideal: 360 } }
              : { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false,
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        localTempStream = mediaStream;
        setPreviewStream(mediaStream);
        setIsCameraLoading(false);
      } catch {
        if (!isCancelled) {
          setIsCameraLoading(false);
          setCameraPreviewError('Camera preview unavailable');
        }
      }
    };

    void startCamera();

    return () => {
      isCancelled = true;
      if (localTempStream) {
        localTempStream.getTracks().forEach((track) => track.stop());
      }
      setPreviewStream(null);
      setIsCameraLoading(false);
      setCameraPreviewError(null);
    };
  }, [activeShelf, isTestingCamera, selectedCamera, cameraOn, localStream]);

  // Attach preview stream to video element whenever stream or shelf changes
  useEffect(() => {
    const videoEl = videoPreviewRef.current;
    if (!videoEl) return;
    if (previewStream) {
      videoEl.srcObject = previewStream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [previewStream, activeShelf]);

  // Output test audio chime with live meter
  const handleTestSpeaker = async () => {
    if (isTestingSpeaker) return;
    setIsTestingSpeaker(true);

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      if (selectedSpeaker && typeof (audioCtx as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function') {
        try {
          await (audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedSpeaker);
        } catch {
          // Ignore setSinkId failure on unsupported browsers
        }
      }

      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime((speakerVolume / 100) * 0.35, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      masterGain.connect(analyser);

      const notes = [523.25, 659.25, 783.99, 1046.5];
      const startTime = audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + idx * 0.12);

        noteGain.gain.setValueAtTime(0, startTime + idx * 0.12);
        noteGain.gain.linearRampToValueAtTime(1, startTime + idx * 0.12 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.12 + 0.35);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(startTime + idx * 0.12);
        osc.stop(startTime + idx * 0.12 + 0.36);
      });

      const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      let testAnimId: number | null = null;

      const trackOutput = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setLiveSpeakerLevel(Math.min(100, Math.round((avg / 128) * 100 * (speakerVolume / 100))));
        testAnimId = requestAnimationFrame(trackOutput);
      };
      testAnimId = requestAnimationFrame(trackOutput);

      setTimeout(() => {
        setIsTestingSpeaker(false);
        setLiveSpeakerLevel(0);
        if (testAnimId) cancelAnimationFrame(testAnimId);
        void audioCtx.close().catch(() => { });
      }, 900);
    } catch {
      setIsTestingSpeaker(false);
      setLiveSpeakerLevel(0);
    }
  };

  // Cleanup mic test timers, recording or playback on unmount or when shelf closes
  useEffect(() => {
    return () => {
      if (micCountdownTimerRef.current) {
        window.clearInterval(micCountdownTimerRef.current);
        micCountdownTimerRef.current = null;
      }
      if (micRecorderRef.current && micRecorderRef.current.state === 'recording') {
        try {
          micRecorderRef.current.stop();
        } catch {
          // Ignore recorder stop error
        }
      }
      if (micAudioRef.current) {
        micAudioRef.current.pause();
      }
      if (micAudioUrlRef.current) {
        URL.revokeObjectURL(micAudioUrlRef.current);
        micAudioUrlRef.current = null;
      }
      setMicTestStage('idle');
      setMicCountdown(3);
    };
  }, [activeShelf]);

  // Test microphone: 3-2-1 countdown, 5 seconds recording with countdown, and manual user click to play
  const handleTestMic = async () => {
    if (micTestStage === 'ready_to_play') {
      const audio = micAudioRef.current;
      if (!audio) {
        setMicTestStage('idle');
        return;
      }
      setMicTestStage('playing');
      audio.onended = () => {
        setMicTestStage('done');
        setTimeout(() => {
          setMicTestStage((curr) => (curr === 'done' ? 'idle' : curr));
        }, 2500);
      };
      audio.onerror = () => {
        setMicTestStage('idle');
      };
      void audio.play().catch(() => {
        setMicTestStage('idle');
      });
      return;
    }

    if (micTestStage === 'playing') {
      if (micAudioRef.current) {
        micAudioRef.current.pause();
      }
      setMicTestStage('idle');
      return;
    }

    if (micTestStage !== 'idle' && micTestStage !== 'done') {
      return;
    }

    if (micCountdownTimerRef.current) {
      window.clearInterval(micCountdownTimerRef.current);
      micCountdownTimerRef.current = null;
    }
    if (micAudioUrlRef.current) {
      URL.revokeObjectURL(micAudioUrlRef.current);
      micAudioUrlRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: buildAudioConstraints(selectedMic),
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream);
      micRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        if (chunks.length === 0) {
          setMicTestStage('idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        micAudioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        micAudioRef.current = audio;
        audio.volume = Math.max(0, Math.min(1, micVolume / 100));

        if (selectedSpeaker && typeof (audio as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function') {
          void (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedSpeaker).catch(() => { });
        }

        setMicTestStage('ready_to_play');
      };

      setMicTestStage('countdown');
      setMicCountdown(3);

      let currentCount = 3;
      const countdownInterval = window.setInterval(() => {
        currentCount -= 1;
        if (currentCount > 0) {
          setMicCountdown(currentCount);
        } else {
          window.clearInterval(countdownInterval);
          micCountdownTimerRef.current = null;

          setMicTestStage('recording');
          setMicCountdown(5);
          recorder.start();

          let recCount = 5;
          const recInterval = window.setInterval(() => {
            recCount -= 1;
            if (recCount > 0) {
              setMicCountdown(recCount);
            } else {
              window.clearInterval(recInterval);
              micCountdownTimerRef.current = null;
              if (recorder.state === 'recording') {
                recorder.stop();
              }
            }
          }, 1000);
          micCountdownTimerRef.current = recInterval;
        }
      }, 1000);
      micCountdownTimerRef.current = countdownInterval;
    } catch {
      setMicTestStage('idle');
    }
  };

  return (
    <footer className="shrink-0 flex items-center justify-between border-t border-border/80 px-6 h-16 bg-card shadow-xs relative z-30">
      {/* Left: Record Button with Popover */}
      <div className="flex items-center gap-3 shrink-0">
        <Popover open={showRecordModal} onOpenChange={setShowRecordModal}>
          <PopoverTrigger
            render={
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="sm"
                className="gap-1.5 font-bold text-xs h-9 cursor-pointer"
              >
                <Radio size={14} className={isRecording ? 'animate-pulse' : ''} />
                <span>{recordingStageLabel}</span>
              </Button>
            }
          />
          <PopoverContent side="top" sideOffset={12} className="w-72 p-3 space-y-3 border-border bg-card shadow-xl" align="start">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Radio size={14} className="text-red-500" />
                <span>Recording</span>
                {recordingElapsedLabel && (
                  <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                    {recordingElapsedLabel}
                  </span>
                )}
              </h4>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="size-5 flex items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>

            <Button
              variant={isRecording ? 'destructive' : 'default'}
              size="sm"
              className="w-full text-xs font-semibold cursor-pointer"
              // Uploading and summarising are not interruptible: stopping
              // mid-upload would leave an orphaned object in storage.
              disabled={recordingStage === 'uploading' || recordingStage === 'processing'}
              onClick={onToggleRecording}
            >
              {recordingStage === 'uploading'
                ? 'Uploading…'
                : recordingStage === 'processing'
                  ? 'Generating summary…'
                  : isRecording
                    ? 'Stop Recording'
                    : 'Start Recording'}
            </Button>

            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles size={13} className="text-primary" />
                <span>AI Summary</span>
              </span>
              <input
                type="checkbox"
                disabled={!canManage}
                checked={aiSummaryEnabled}
                onChange={(e) => setAiSummaryEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Center: Controls Container (Mic to Leave) with Attached Matching-Width Shelf Above */}
      <div className="flex-1 flex justify-center px-4">
        <div className="relative flex flex-col items-center">
          {/* Setting Shelf: Attached directly above center controls, uniform width across all settings, xs radius */}
          {activeShelf && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[540px] max-w-[92vw] bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xs px-3.5 py-2.5 z-40 animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between gap-3 w-full">
                {/* 1. Microphone Shelf */}
                {activeShelf === 'mic' && (
                  <>
                    {/* Left: Microphone device select dropdown */}
                    <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-48 sm:max-w-52 shrink-0"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Mic size={14} className="text-emerald-500 shrink-0" />
                              <span className="truncate">{currentMicLabel}</span>
                            </span>
                            <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                          </button>
                        }
                      />
                      <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-card shadow-xl rounded-xs" align="start">
                        <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border mb-1">
                          Select Microphone
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {audioInputs.length > 0 ? (
                            audioInputs.map((d, idx) => {
                              const lbl = getCleanDeviceLabel(d, 'Microphone', idx);
                              const isSelected = selectedMic === d.deviceId || (!selectedMic && d.deviceId === 'default');
                              return (
                                <button
                                  key={d.deviceId || idx}
                                  type="button"
                                  onClick={() => {
                                    onSelectMic(d.deviceId);
                                    setDeviceDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-xs text-xs transition-colors text-left cursor-pointer",
                                    isSelected
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                                      : "text-foreground hover:bg-muted"
                                  )}
                                >
                                  <span className="truncate flex-1 mr-2">{lbl}</span>
                                  {isSelected && <Check size={14} className="text-emerald-500 shrink-0" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-xs text-muted-foreground p-2">Default Microphone</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Right: Test button, volume slider, and vertical input level */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={handleTestMic}
                        disabled={micTestStage === 'countdown' || micTestStage === 'recording'}
                        className={cn(
                          "h-7 w-[104px] justify-center text-xs gap-1 cursor-pointer font-medium rounded-xs px-2 shrink-0 transition-all",
                          micTestStage === 'countdown' && "border-amber-500/50 bg-amber-500/10 text-amber-500 dark:text-amber-400 cursor-wait",
                          micTestStage === 'recording' && "border-red-500/50 bg-red-500/10 text-red-500 dark:text-red-400 cursor-wait",
                          micTestStage === 'ready_to_play' && "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-semibold shadow-xs animate-pulse",
                          micTestStage === 'playing' && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          micTestStage === 'done' && "border-emerald-500 bg-emerald-500 text-white dark:text-white font-semibold",
                          micTestStage === 'idle' && "hover:bg-secondary text-foreground"
                        )}
                      >
                        {micTestStage === 'idle' && (
                          <>
                            <Play size={10} className="text-emerald-500 fill-emerald-500 shrink-0" />
                            <span className="truncate">Test Mic</span>
                          </>
                        )}
                        {micTestStage === 'countdown' && (
                          <>
                            <span className="size-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                            <span className="truncate font-mono">Ready {micCountdown}s</span>
                          </>
                        )}
                        {micTestStage === 'recording' && (
                          <>
                            <span className="size-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                            <span className="truncate font-mono">Rec {micCountdown}s</span>
                          </>
                        )}
                        {micTestStage === 'ready_to_play' && (
                          <>
                            <Play size={10} className="text-emerald-500 fill-emerald-500 shrink-0" />
                            <span className="truncate">Play Test</span>
                          </>
                        )}
                        {micTestStage === 'playing' && (
                          <>
                            <Volume2 size={12} className="text-emerald-500 animate-pulse shrink-0" />
                            <span className="truncate">Playing...</span>
                          </>
                        )}
                        {micTestStage === 'done' && (
                          <>
                            <Check size={12} className="shrink-0" />
                            <span className="truncate">Sounds Good</span>
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!micOn || micVolume === 0 ? (
                          <VolumeX size={13} className="text-muted-foreground shrink-0" />
                        ) : micVolume <= 50 ? (
                          <Volume1 size={13} className="text-muted-foreground shrink-0" />
                        ) : (
                          <Volume2 size={13} className="text-muted-foreground shrink-0" />
                        )}
                        <Slider
                          value={[micVolume]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([val]) => setMicVolume(val)}
                          className="w-24"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{micVolume}%</span>
                      </div>

                      {/* Vertical input level with color indicators (green -> yellow -> red) */}
                      <div
                        className="relative h-7 w-2 bg-muted dark:bg-zinc-800 rounded-xs overflow-hidden flex flex-col-reverse border border-border dark:border-zinc-700/80 shrink-0"
                        title={`Live Input Level: ${liveMicLevel}%`}
                      >
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
                          style={{ height: `${micOn ? liveMicLevel : 0}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Speaker Shelf */}
                {activeShelf === 'speaker' && (
                  <>
                    {/* Left: Speaker device select dropdown */}
                    <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-48 sm:max-w-52 shrink-0"
                          >
                            <span className="flex items-center gap-2 truncate">
                              {!speakerOn || speakerVolume === 0 ? (
                                <VolumeX size={14} className="text-emerald-500 shrink-0" />
                              ) : speakerVolume <= 50 ? (
                                <Volume1 size={14} className="text-emerald-500 shrink-0" />
                              ) : (
                                <Volume2 size={14} className="text-emerald-500 shrink-0" />
                              )}
                              <span className="truncate">{currentSpeakerLabel}</span>
                            </span>
                            <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                          </button>
                        }
                      />
                      <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-card shadow-xl rounded-xs" align="start">
                        <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border mb-1">
                          Select Speaker
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {audioOutputs.length > 0 ? (
                            audioOutputs.map((d, idx) => {
                              const lbl = getCleanDeviceLabel(d, 'Speaker', idx);
                              const isSelected = selectedSpeaker === d.deviceId || (!selectedSpeaker && d.deviceId === 'default');
                              return (
                                <button
                                  key={d.deviceId || idx}
                                  type="button"
                                  onClick={() => {
                                    onSelectSpeaker(d.deviceId);
                                    setDeviceDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-xs text-xs transition-colors text-left cursor-pointer",
                                    isSelected
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                                      : "text-foreground hover:bg-muted"
                                  )}
                                >
                                  <span className="truncate flex-1 mr-2">{lbl}</span>
                                  {isSelected && <Check size={14} className="text-emerald-500 shrink-0" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-xs text-muted-foreground p-2">Default Speaker</div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Right: Speaker volume slider, test button, and vertical output level */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={handleTestSpeaker}
                        disabled={isTestingSpeaker}
                        className="h-7 w-20 justify-center text-xs gap-1 cursor-pointer font-medium hover:bg-secondary rounded-xs px-2 shrink-0"
                      >
                        <Play size={10} className={cn("text-emerald-500 fill-emerald-500 shrink-0", isTestingSpeaker && "animate-pulse")} />
                        <span className="truncate">{isTestingSpeaker ? 'Testing...' : 'Test'}</span>
                      </Button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!speakerOn || speakerVolume === 0 ? (
                          <VolumeX size={13} className="text-muted-foreground shrink-0" />
                        ) : speakerVolume <= 50 ? (
                          <Volume1 size={13} className="text-muted-foreground shrink-0" />
                        ) : (
                          <Volume2 size={13} className="text-muted-foreground shrink-0" />
                        )}
                        <Slider
                          value={[speakerVolume]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([val]) => setSpeakerVolume(val)}
                          className="w-24"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{speakerVolume}%</span>
                      </div>

                      {/* Vertical output level with color indicators */}
                      <div
                        className="relative h-7 w-2 bg-muted dark:bg-zinc-800 rounded-xs overflow-hidden flex flex-col-reverse border border-border dark:border-zinc-700/80 shrink-0"
                        title={`Live Output Level: ${liveSpeakerLevel}%`}
                      >
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
                          style={{ height: `${liveSpeakerLevel}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Camera Shelf */}
                {activeShelf === 'camera' && (
                  <div className="flex flex-col gap-2.5 w-full">
                    {/* Live camera video preview box (shown ONLY when user clicks Test Live Preview) */}
                    {isTestingCamera && (
                      <div className="relative w-full h-44 bg-zinc-950 rounded-xs overflow-hidden border border-border shadow-xs flex items-center justify-center animate-in fade-in duration-200">
                        <video
                          ref={videoPreviewRef}
                          autoPlay
                          playsInline
                          muted
                          className={cn(
                            "w-full h-full object-contain scale-x-[-1]",
                            (isCameraLoading || cameraPreviewError || !previewStream) && "opacity-0"
                          )}
                        />

                        {isCameraLoading && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground gap-2 bg-zinc-950">
                            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>Starting camera preview...</span>
                          </div>
                        )}

                        {!isCameraLoading && cameraPreviewError && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400 p-2 text-center bg-zinc-950">
                            {cameraPreviewError}
                          </div>
                        )}

                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-xs text-[9px] text-white px-1.5 py-0.5 rounded-xs font-medium flex items-center gap-1 pointer-events-none">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Live Preview</span>
                        </div>
                      </div>
                    )}

                    {/* Controls Row: [Select Camera dropdown] and [Test live preview button] */}
                    <div className="flex items-center justify-between gap-3 w-full">
                      {/* Left: Camera device select dropdown */}
                      <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-56"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Video size={14} className="text-emerald-500 shrink-0" />
                                <span className="truncate">{currentCameraLabel}</span>
                              </span>
                              <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                            </button>
                          }
                        />
                        <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-card shadow-xl rounded-xs" align="start">
                          <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border mb-1">
                            Select Camera
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {videoInputs.length > 0 ? (
                              videoInputs.map((d, idx) => {
                                const lbl = getCleanDeviceLabel(d, 'Camera', idx);
                                const isSelected = selectedCamera === d.deviceId || (!selectedCamera && d.deviceId === 'default');
                                return (
                                  <button
                                    key={d.deviceId || idx}
                                    type="button"
                                    onClick={() => {
                                      onSelectCamera(d.deviceId);
                                      setDeviceDropdownOpen(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center justify-between px-2 py-1.5 rounded-xs text-xs transition-colors text-left cursor-pointer",
                                      isSelected
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                                        : "text-foreground hover:bg-muted"
                                    )}
                                  >
                                    <span className="truncate flex-1 mr-2">{lbl}</span>
                                    {isSelected && <Check size={14} className="text-emerald-500 shrink-0" />}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-xs text-muted-foreground p-2">Default Camera</div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Right: Test live preview button */}
                      <Button
                        type="button"
                        variant={isTestingCamera ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setIsTestingCamera((prev) => !prev)}
                        className="h-8 text-xs gap-1.5 font-medium px-3 cursor-pointer shrink-0"
                      >
                        {isTestingCamera ? (
                          <>
                            <VideoOff size={13} className="shrink-0" />
                            <span>Stop Preview</span>
                          </>
                        ) : (
                          <>
                            <Play size={11} className="text-emerald-500 fill-emerald-500 shrink-0" />
                            <span>Test Live Preview</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Centered Controls: Mic, Camera, Speaker, Screen Share, Hand, Leave */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mic Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={micOn ? 'Mute Mic (Alt+C)' : 'Unmute Mic (Alt+C)'} side="top">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${micOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'mic' ? 'Close Mic Settings' : 'Microphone Settings'} side="top">
                <button
                  type="button"
                  onClick={() => handleToggleShelf('mic')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Microphone Settings"
                >
                  {activeShelf === 'mic' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Camera Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={cameraOn ? 'Turn Camera Off (Alt+V)' : 'Turn Camera On (Alt+V)'} side="top">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${cameraOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                  {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'camera' ? 'Close Camera Settings' : 'Camera Settings'} side="top">
                <button
                  type="button"
                  onClick={() => handleToggleShelf('camera')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Camera Settings"
                >
                  {activeShelf === 'camera' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Speaker Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={speakerOn && speakerVolume > 0 ? 'Deafen / Mute Speaker (Alt+B)' : 'Undeafen Speaker (Alt+B)'} side="top">
                <button
                  type="button"
                  onClick={onToggleSpeaker}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${speakerOn && speakerVolume > 0 ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                  {!speakerOn || speakerVolume === 0 ? (
                    <VolumeX size={16} />
                  ) : speakerVolume <= 50 ? (
                    <Volume1 size={16} />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'speaker' ? 'Close Speaker Settings' : 'Speaker Settings'} side="top">
                <button
                  type="button"
                  onClick={() => handleToggleShelf('speaker')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Speaker Settings"
                >
                  {activeShelf === 'speaker' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Screen Share Button */}
            {onToggleScreenShare && (
              <Tooltip content={isScreenSharing ? 'Stop Presenting Screen' : 'Share Screen'} side="top">
                <button
                  type="button"
                  onClick={onToggleScreenShare}
                  className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${
                    isScreenSharing
                      ? 'bg-accent text-accent-foreground border-accent shadow-md scale-105'
                      : 'border-border bg-card text-foreground hover:bg-secondary'
                  }`}
                  aria-label={isScreenSharing ? 'Stop Presenting Screen' : 'Share Screen'}
                >
                  {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
                </button>
              </Tooltip>
            )}

            {/* Hand Raise Button */}
            <Tooltip content={handRaised ? 'Lower Hand' : 'Raise Hand'} side="top">
              <button
                type="button"
                onClick={onToggleHandRaise}
                className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${handRaised
                  ? 'bg-accent text-accent-foreground border-accent shadow-md scale-105'
                  : 'border-border bg-card text-foreground hover:bg-secondary'
                  }`}
              >
                <Hand size={18} />
              </button>
            </Tooltip>

            {/* Leave Button */}
            <Button
              variant="destructive"
              className="rounded-full px-4 h-10 shrink-0 font-bold gap-1.5 shadow-md cursor-pointer"
              onClick={onLeaveClick}
            >
              <PhoneOff size={16} />
              <span>Leave</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Panels Navigation Buttons (Chat, Q&A) & View Settings */}
      <div className="flex items-center gap-1.5 shrink-0">
        {PANELS.filter((item) => item.key !== 'people').map((item) => (
          <Tooltip key={item.key} content={item.label} side="top">
            <button
              type="button"
              onClick={() => onSelectPanel(panel === item.key ? null : item.key)}
              className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-colors cursor-pointer ${panel === item.key
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
            >
              <item.icon size={18} />
            </button>
          </Tooltip>
        ))}

        {/* Appearance / View Mode Settings (now includes Fullscreen) */}
        <Popover open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <Tooltip content={showSettingsModal ? undefined : "Meeting View Settings"} side="top" disabled={showSettingsModal}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                  aria-label="Meeting View Settings"
                >
                  <Settings size={18} />
                </button>
              }
            />
          </Tooltip>
          <PopoverContent side="top" sideOffset={12} className="w-68 p-3 space-y-3 border-border bg-card shadow-xl rounded-xs" align="end">
            <div className="font-bold text-xs text-foreground border-b border-border pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Settings size={14} className="text-primary" />
                <span>Settings</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="size-5 flex items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>

            {/* 1. Appearance: Light / Dark / System */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground">Appearance</span>
              <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-xs border border-border/50">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-xs text-xs font-medium transition-colors cursor-pointer",
                    theme === 'light'
                      ? "bg-card text-emerald-500 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun size={12} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-xs text-xs font-medium transition-colors cursor-pointer",
                    theme === 'dark'
                      ? "bg-card text-emerald-500 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 px-2 rounded-xs text-xs font-medium transition-colors cursor-pointer",
                    theme === 'system'
                      ? "bg-card text-emerald-500 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Monitor size={12} />
                  <span>System</span>
                </button>
              </div>
            </div>

            {/* 2. Keybinds: List all keybinds + new keybind Alt + N */}
            <div className="space-y-1.5 border-t border-border/60 pt-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Keyboard size={13} className="text-primary" />
                <span>Keybinds</span>
              </div>

              <div className="space-y-1 text-xs">
                {/* Alt + C: Mic */}
                <div className="flex items-center justify-between rounded-xs px-2 py-1 bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic size={12} className="text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">Mute / Unmute</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Kbd>Alt</Kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Kbd>C</Kbd>
                  </div>
                </div>

                {/* Alt + V: Camera */}
                <div className="flex items-center justify-between rounded-xs px-2 py-1 bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video size={12} className="text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">Camera On / Off</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Kbd>Alt</Kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Kbd>V</Kbd>
                  </div>
                </div>

                {/* Alt + B: Deafen */}
                <div className="flex items-center justify-between rounded-xs px-2 py-1 bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <VolumeX size={12} className="text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">Deafen / Undeafen</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Kbd>Alt</Kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Kbd>B</Kbd>
                  </div>
                </div>

                {/* Alt + N: Mute All Three */}
                <div className="flex items-center justify-between rounded-xs px-2 py-1 bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <MicOff size={12} className="text-rose-400 shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">Mute All Three</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Kbd>Alt</Kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Kbd>N</Kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Fullscreen toggle button */}
            <div className="border-t border-border/60 pt-2.5">
              <Button
                variant={isFullscreen ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-xs font-medium gap-2 h-8 rounded-xs cursor-pointer"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </footer>
  );
};
