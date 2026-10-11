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
  MonitorUp,
  PhoneOff,
  Hand,
  Settings,
  ChevronUp,
  ChevronDown,
  Radio,
  Sparkles,
  Maximize2,
  Minimize2,
  Users,
  MessageSquare,
  MessageCircleQuestion,
  Play,
  X,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { buildAudioConstraints } from '@/lib/audio-capture';
import type { LayoutViewMode } from './MeetingVideoStage';

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

const getVolumeIcon = (volume: number, enabled: boolean = true) => {
  if (!enabled || volume === 0) return VolumeX;
  if (volume <= 50) return Volume1;
  return Volume2;
};

export const PANELS = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'qa', label: 'Q&A', icon: MessageCircleQuestion },
] as const;

export type PanelKey = (typeof PANELS)[number]['key'] | 'polls';

export interface MeetingControlsProps {
  localStream?: MediaStream | null;

  // Recording & AI Summary
  isRecording: boolean;
  onToggleRecording: () => void;
  showRecordModal: boolean;
  setShowRecordModal: (open: boolean) => void;
  aiSummaryEnabled: boolean;
  setAiSummaryEnabled: (enabled: boolean) => void;
  canManage: boolean;

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

  // Screen share & Hand
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  handRaised: boolean;
  onToggleHandRaise: () => void;

  // Fullscreen & Leave
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLeaveClick: () => void;

  // Panels & View settings
  panel: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
  layoutMode: LayoutViewMode;
  onSelectLayoutMode: (mode: LayoutViewMode) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (open: boolean) => void;
}

/** Bottom toolbar controls dock for in-meeting actions */
export const MeetingControls: React.FC<MeetingControlsProps> = ({
  localStream,
  isRecording,
  onToggleRecording,
  showRecordModal,
  setShowRecordModal,
  aiSummaryEnabled,
  setAiSummaryEnabled,
  canManage,
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
  isScreenSharing,
  onToggleScreenShare,
  handRaised,
  onToggleHandRaise,
  isFullscreen,
  onToggleFullscreen,
  onLeaveClick,
  panel,
  onSelectPanel,
  layoutMode,
  onSelectLayoutMode,
  showSettingsModal,
  setShowSettingsModal,
}) => {
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
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);

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
      setLiveMicLevel(0);
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
        void audioCtx.close().catch(() => {});
      }
    };
  }, [activeShelf, selectedMic, micOn, micVolume]);

  // Real-time camera preview stream for the video settings shelf
  useEffect(() => {
    if (activeShelf !== 'camera') {
      setPreviewStream(null);
      setIsCameraLoading(false);
      setCameraPreviewError(null);
      return;
    }

    let isCancelled = false;
    let localTempStream: MediaStream | null = null;
    setIsCameraLoading(true);
    setCameraPreviewError(null);

    // If localStream from WebRTC already has a live video track matching current camera, use it directly
    const hasLiveLocalVideo =
      cameraOn &&
      Boolean(localStream) &&
      localStream!.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled !== false);

    if (hasLiveLocalVideo && localStream) {
      setPreviewStream(localStream);
      setIsCameraLoading(false);
      return () => {
        // Do not stop localStream tracks as they belong to the live call
      };
    }

    const startCameraPreview = async () => {
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

    void startCameraPreview();

    return () => {
      isCancelled = true;
      if (localTempStream) {
        localTempStream.getTracks().forEach((track) => track.stop());
      }
      setPreviewStream(null);
    };
  }, [activeShelf, selectedCamera, cameraOn, localStream]);

  // Attach preview stream to video element whenever stream or shelf changes
  useEffect(() => {
    const videoEl = videoPreviewRef.current;
    if (!videoEl) return;
    if (previewStream) {
      videoEl.srcObject = previewStream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
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
        } catch {}
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
        void audioCtx.close().catch(() => {});
      }, 900);
    } catch {
      setIsTestingSpeaker(false);
      setLiveSpeakerLevel(0);
    }
  };

  // Cleanup mic test timers, recording or playback on unmount or when shelf closes
  useEffect(() => {
    if (activeShelf !== 'mic') {
      if (micCountdownTimerRef.current) {
        window.clearInterval(micCountdownTimerRef.current);
        micCountdownTimerRef.current = null;
      }
      if (micRecorderRef.current && micRecorderRef.current.state === 'recording') {
        try {
          micRecorderRef.current.stop();
        } catch {}
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
    }
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
          void (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedSpeaker).catch(() => {});
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
    <footer className="shrink-0 flex items-center justify-between border-t border-border px-6 h-16 bg-background relative z-30">
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
                <span>{isRecording ? 'Recording' : 'Record'}</span>
              </Button>
            }
          />
          <PopoverContent side="top" sideOffset={12} className="w-72 p-3 space-y-3 border-border bg-card shadow-xl" align="start">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Radio size={14} className="text-red-500" />
                <span>Recording</span>
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
              onClick={onToggleRecording}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>

            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-500" />
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
          {/* Setting Shelf: Attached directly above center controls, matching width, xs radius */}
          {activeShelf && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max min-w-[540px] max-w-[92vw] bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xs px-3.5 py-2.5 z-40 animate-in slide-in-from-bottom-2 duration-150">
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
                        {(() => {
                          const VolIcon = getVolumeIcon(micVolume, micOn);
                          return <VolIcon size={13} className="text-muted-foreground shrink-0" />;
                        })()}
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
                        className="relative h-7 w-2 bg-zinc-800 rounded-xs overflow-hidden flex flex-col-reverse border border-zinc-700/80 shrink-0"
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
                              {(() => {
                                const VolIcon = getVolumeIcon(speakerVolume, speakerOn);
                                return <VolIcon size={14} className="text-emerald-500 shrink-0" />;
                              })()}
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
                        {(() => {
                          const VolIcon = getVolumeIcon(speakerVolume, speakerOn);
                          return <VolIcon size={13} className="text-muted-foreground shrink-0" />;
                        })()}
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
                        className="relative h-7 w-2 bg-zinc-800 rounded-xs overflow-hidden flex flex-col-reverse border border-zinc-700/80 shrink-0"
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
                  <>
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

                    {/* Right: Live camera video preview box */}
                    <div className="flex items-center shrink-0">
                      <div className="relative w-44 h-24 bg-zinc-950 rounded-xs overflow-hidden border border-border shadow-xs flex items-center justify-center shrink-0">
                        <video
                          ref={videoPreviewRef}
                          autoPlay
                          playsInline
                          muted
                          className={cn(
                            "w-full h-full object-cover scale-x-[-1]",
                            (isCameraLoading || cameraPreviewError || !previewStream) && "opacity-0"
                          )}
                        />

                        {isCameraLoading && (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground gap-1.5 bg-zinc-950">
                            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>Loading...</span>
                          </div>
                        )}

                        {!isCameraLoading && cameraPreviewError && (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 p-2 text-center bg-zinc-950">
                            {cameraPreviewError}
                          </div>
                        )}

                        <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-[9px] text-white px-1.5 py-0.5 rounded-xs font-medium flex items-center gap-1 pointer-events-none">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Live Preview</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Centered Controls: Mic, Camera, Speaker, Screen Share, Hand, Leave */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mic Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={micOn ? 'Mute Mic' : 'Unmute Mic'} side="top">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
                    micOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'mic' ? 'Close Mic Settings' : 'Microphone Settings'} side="top">
                <button
                  type="button"
                  onClick={() => setActiveShelf(activeShelf === 'mic' ? null : 'mic')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Microphone Settings"
                >
                  {activeShelf === 'mic' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Camera Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'} side="top">
                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
                    cameraOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'camera' ? 'Close Camera Settings' : 'Camera Settings'} side="top">
                <button
                  type="button"
                  onClick={() => setActiveShelf(activeShelf === 'camera' ? null : 'camera')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Camera Settings"
                >
                  {activeShelf === 'camera' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Speaker Split Button: Icon on Left, Chevron on Right */}
            <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
              <Tooltip content={speakerOn && speakerVolume > 0 ? 'Mute Speaker' : 'Unmute Speaker'} side="top">
                <button
                  type="button"
                  onClick={onToggleSpeaker}
                  className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
                    speakerOn && speakerVolume > 0 ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {(() => {
                    const VolIcon = getVolumeIcon(speakerVolume, speakerOn);
                    return <VolIcon size={16} />;
                  })()}
                </button>
              </Tooltip>
              <Tooltip content={activeShelf === 'speaker' ? 'Close Speaker Settings' : 'Speaker Settings'} side="top">
                <button
                  type="button"
                  onClick={() => setActiveShelf(activeShelf === 'speaker' ? null : 'speaker')}
                  className="flex size-7 w-7 h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Speaker Settings"
                >
                  {activeShelf === 'speaker' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </Tooltip>
            </div>

            {/* Screen Share Button */}
            <Tooltip content={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'} side="top">
              <button
                type="button"
                onClick={onToggleScreenShare}
                className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  isScreenSharing
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                }`}
              >
                <MonitorUp size={18} />
              </button>
            </Tooltip>

            {/* Hand Raise Button */}
            <Tooltip content={handRaised ? 'Lower Hand' : 'Raise Hand'} side="top">
              <button
                type="button"
                onClick={onToggleHandRaise}
                className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${
                  handRaised
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-105'
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

      {/* Right: Panels Navigation Buttons (People, Chat, Q&A) & View Settings */}
      <div className="flex items-center gap-1.5 shrink-0">
        {PANELS.map((item) => (
          <Tooltip key={item.key} content={item.label} side="top">
            <button
              type="button"
              onClick={() => onSelectPanel(panel === item.key ? null : item.key)}
              className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-colors cursor-pointer ${
                panel === item.key
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
          <PopoverContent side="top" sideOffset={12} className="w-64 p-3 space-y-2.5 border-border bg-card shadow-xl" align="end">
            <div className="font-bold text-xs text-foreground border-b border-border pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <LayoutGrid size={14} className="text-emerald-500" />
                <span>Layout & View</span>
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
            <div className="space-y-1.5 text-xs">
              <Button
                variant={layoutMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-xs font-medium gap-2 h-8 cursor-pointer"
                onClick={() => onSelectLayoutMode('grid')}
              >
                <LayoutGrid size={14} />
                <span>Grid View</span>
              </Button>
              <Button
                variant={layoutMode === 'focus' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-xs font-medium gap-2 h-8 cursor-pointer"
                onClick={() => onSelectLayoutMode('focus')}
              >
                <Maximize2 size={14} />
                <span>Speaker Focus</span>
              </Button>
              <Button
                variant={layoutMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start text-xs font-medium gap-2 h-8 cursor-pointer"
                onClick={() => onSelectLayoutMode('compact')}
              >
                <Minimize2 size={14} />
                <span>Compact View</span>
              </Button>

              {/* Fullscreen Button moved into Settings */}
              <div className="border-t border-border pt-1.5 mt-1.5">
                <Button
                  variant={isFullscreen ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start text-xs font-medium gap-2 h-8 cursor-pointer"
                  onClick={onToggleFullscreen}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </footer>
  );
};
