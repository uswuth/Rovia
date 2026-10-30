import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { buildAudioConstraints } from '@/lib/audio-capture';
import type { PanelKey } from './meetingPanels';
import type { CaptionFontSize, CaptionOpacity } from '@/components/ui/live-caption-overlay';
import { MeetingDeviceShelf } from './controls/MeetingDeviceShelf';
import { getCleanDeviceLabel, type ShelfType } from './controls/device-utils';
import { MeetingActionButtons } from './controls/MeetingActionButtons';
import { MeetingPanelButtons } from './controls/MeetingPanelButtons';
import { MeetingViewSettingsModal } from './controls/MeetingViewSettingsModal';
import { MobileMoreMenu } from './controls/MobileMoreMenu';

export type { PanelKey };

export interface MeetingControlsProps {
  localStream?: MediaStream | null;
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
  // Closed Captions / Subtitles
  captionsEnabled?: boolean;
  captionsSupported?: boolean;
  onToggleCaptions?: () => void;
  captionFontSize?: CaptionFontSize;
  onSelectCaptionFontSize?: (size: CaptionFontSize) => void;
  captionOpacity?: CaptionOpacity;
  onSelectCaptionOpacity?: (opacity: CaptionOpacity) => void;
  // AI Summary Switch (Host-only)
  isHost?: boolean;
  aiSummaryEnabled?: boolean;
  onToggleAiSummary?: () => void;
  // View Settings & Leave
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onLeaveClick: () => void;
  panel?: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
  showSettingsModal?: boolean;
  setShowSettingsModal?: (open: boolean) => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  localStream,
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
  captionsEnabled,
  captionsSupported,
  onToggleCaptions,
  captionFontSize,
  onSelectCaptionFontSize,
  captionOpacity,
  onSelectCaptionOpacity,
  isHost = false,
  aiSummaryEnabled = false,
  onToggleAiSummary,
  isFullscreen = false,
  onToggleFullscreen,
  onLeaveClick,
  panel,
  onSelectPanel,
  showSettingsModal: controlledSettingsModal,
  setShowSettingsModal: controlledSetShowSettingsModal,
}) => {
  const [internalSettingsModal, setInternalSettingsModal] = useState(false);
  const showSettingsModal = controlledSettingsModal ?? internalSettingsModal;
  const setShowSettingsModal = controlledSetShowSettingsModal ?? setInternalSettingsModal;

  const [activeShelf, setActiveShelf] = useState<ShelfType>(null);
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [micVolume, setMicVolume] = useState<number>(100);
  const [liveMicLevel, setLiveMicLevel] = useState<number>(0);
  const [speakerVolume, setSpeakerVolume] = useState<number>(100);
  const [liveSpeakerLevel, setLiveSpeakerLevel] = useState<number>(0);

  const [micTestStage, setMicTestStage] = useState<'idle' | 'countdown' | 'recording' | 'ready_to_play' | 'playing' | 'done'>('idle');
  const [micCountdown, setMicCountdown] = useState<number>(3);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioChunksRef = useRef<Blob[]>([]);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAudioUrlRef = useRef<string | null>(null);
  const micCountdownTimerRef = useRef<number | null>(null);

  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const speakerTestTimerRef = useRef<number | null>(null);

  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [cameraPreviewError, setCameraPreviewError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const shelfRef = useRef<HTMLDivElement | null>(null);

  // Close shelf on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeShelf && shelfRef.current && !shelfRef.current.contains(e.target as Node)) {
        if (!deviceDropdownOpen) {
          setActiveShelf(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeShelf, deviceDropdownOpen]);

  // Handle camera preview stream
  useEffect(() => {
    if (!isTestingCamera) {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        setTimeout(() => {
          setPreviewStream(null);
          setCameraPreviewError(null);
          setIsCameraLoading(false);
        }, 0);
      }
      return;
    }

    let isSubscribed = true;
    setTimeout(() => {
      if (isSubscribed) {
        setIsCameraLoading(true);
        setCameraPreviewError(null);
      }
    }, 0);

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera && selectedCamera !== 'default' ? { deviceId: { exact: selectedCamera } } : true,
          audio: false,
        });
        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setPreviewStream(stream);
        setIsCameraLoading(false);
      } catch (err) {
        if (!isSubscribed) return;
        setIsCameraLoading(false);
        setCameraPreviewError((err as Error)?.message || 'Failed to access camera preview');
      }
    };

    void startCamera();

    return () => {
      isSubscribed = false;
    };
  }, [isTestingCamera, previewStream, selectedCamera]);

  useEffect(() => {
    if (videoPreviewRef.current && previewStream) {
      videoPreviewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Audio level monitoring
  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack || !micOn) {
      const t = setTimeout(() => setLiveMicLevel(0), 0);
      return () => clearTimeout(t);
    }

    let isMounted = true;
    let audioCtx: AudioContext | null = null;
    let animationId: number | null = null;

    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!isMounted) return;
        analyser.getByteFrequencyData(buffer);
        const sum = buffer.reduce((a, b) => a + b, 0);
        const avg = sum / buffer.length;
        setLiveMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationId = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // AudioContext fallback
    }

    return () => {
      isMounted = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) void audioCtx.close();
    };
  }, [localStream, micOn]);

  const handleToggleShelf = (type: 'mic' | 'camera' | 'speaker') => {
    setActiveShelf((curr) => (curr === type ? null : type));
    setDeviceDropdownOpen(false);
  };

  const handleTestSpeaker = () => {
    if (isTestingSpeaker) return;
    setIsTestingSpeaker(true);
    setLiveSpeakerLevel(75);

    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(Math.max(0.01, (speakerVolume / 100) * 0.3), audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1);

      speakerTestTimerRef.current = window.setTimeout(() => {
        setIsTestingSpeaker(false);
        setLiveSpeakerLevel(0);
        void audioCtx.close();
      }, 1000);
    } catch {
      setIsTestingSpeaker(false);
      setLiveSpeakerLevel(0);
    }
  };

  const handleTestMic = async () => {
    if (micTestStage === 'playing' || micTestStage === 'recording' || micTestStage === 'countdown') return;

    if (micTestStage === 'ready_to_play') {
      if (!micAudioRef.current) return;
      setMicTestStage('playing');
      micAudioRef.current.onended = () => {
        setMicTestStage('done');
        window.setTimeout(() => setMicTestStage('idle'), 2000);
      };
      void micAudioRef.current.play().catch(() => setMicTestStage('idle'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(selectedMic && selectedMic !== 'default' ? selectedMic : undefined),
      });

      const recorder = new MediaRecorder(stream);
      micRecorderRef.current = recorder;
      micAudioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) micAudioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const chunks = micAudioChunksRef.current;
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

  const currentMicDevice = audioInputs.find((d) => d.deviceId === selectedMic);
  const currentMicLabel = getCleanDeviceLabel(currentMicDevice, 'Microphone', 0);

  const currentSpeakerDevice = audioOutputs.find((d) => d.deviceId === selectedSpeaker);
  const currentSpeakerLabel = getCleanDeviceLabel(currentSpeakerDevice, 'Speaker', 0);

  const currentCameraDevice = videoInputs.find((d) => d.deviceId === selectedCamera);
  const currentCameraLabel = getCleanDeviceLabel(currentCameraDevice, 'Camera', 0);

  return (
    <footer className="shrink-0 flex items-center justify-between border-t border-border/80 px-2 sm:px-6 h-16 bg-card shadow-xs relative z-30">
      {/* Left: AI Summary Switch (Host-Only) and status */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {isHost && onToggleAiSummary && (
          <Tooltip
            content={aiSummaryEnabled ? 'AI Summary Enabled (Meeting end generates summary)' : 'Enable AI Summary'}
            side="top"
            align="start"
          >
            <button
              type="button"
              onClick={onToggleAiSummary}
              className={`flex size-10 w-10 h-10 min-w-10 min-h-10 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${aiSummaryEnabled
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              aria-label="Toggle AI Summary"
            >
              <Sparkles size={18} className={aiSummaryEnabled ? 'animate-pulse' : ''} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Center on desktop, structured row on mobile */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 px-0.5">
          <div className="relative flex flex-col items-center shrink-0">
            <MeetingDeviceShelf
              activeShelf={activeShelf}
              shelfRef={shelfRef}
              deviceDropdownOpen={deviceDropdownOpen}
              setDeviceDropdownOpen={setDeviceDropdownOpen}
              audioInputs={audioInputs}
              selectedMic={selectedMic}
              onSelectMic={onSelectMic}
              currentMicLabel={currentMicLabel}
              micOn={micOn}
              micVolume={micVolume}
              setMicVolume={setMicVolume}
              liveMicLevel={liveMicLevel}
              micTestStage={micTestStage}
              micCountdown={micCountdown}
              handleTestMic={handleTestMic}
              audioOutputs={audioOutputs}
              selectedSpeaker={selectedSpeaker}
              onSelectSpeaker={onSelectSpeaker}
              currentSpeakerLabel={currentSpeakerLabel}
              speakerOn={speakerOn}
              speakerVolume={speakerVolume}
              setSpeakerVolume={setSpeakerVolume}
              liveSpeakerLevel={liveSpeakerLevel}
              isTestingSpeaker={isTestingSpeaker}
              handleTestSpeaker={handleTestSpeaker}
              videoInputs={videoInputs}
              selectedCamera={selectedCamera}
              onSelectCamera={onSelectCamera}
              currentCameraLabel={currentCameraLabel}
              isTestingCamera={isTestingCamera}
              setIsTestingCamera={setIsTestingCamera}
              videoPreviewRef={videoPreviewRef}
              isCameraLoading={isCameraLoading}
              cameraPreviewError={cameraPreviewError}
              previewStream={previewStream}
            />

            <MeetingActionButtons
              micOn={micOn}
              onToggleMic={onToggleMic}
              activeShelf={activeShelf}
              onToggleShelf={handleToggleShelf}
              cameraOn={cameraOn}
              onToggleCamera={onToggleCamera}
              speakerOn={speakerOn}
              speakerVolume={speakerVolume}
              onToggleSpeaker={onToggleSpeaker}
              isScreenSharing={isScreenSharing}
              onToggleScreenShare={onToggleScreenShare}
              handRaised={handRaised}
              onToggleHandRaise={onToggleHandRaise}
              captionsEnabled={captionsEnabled}
              captionsSupported={captionsSupported}
              onToggleCaptions={onToggleCaptions}
              onLeaveClick={onLeaveClick}
            />
          </div>

          {/* Right Panel buttons (Chat, Q&A) and Mobile More Menu on mobile */}
          <div className="flex sm:hidden items-center gap-1 shrink-0 pl-1 border-l border-border/60">
            <MeetingPanelButtons
              panel={panel}
              onSelectPanel={onSelectPanel}
            />

            <MobileMoreMenu
              isHost={isHost}
              aiSummaryEnabled={aiSummaryEnabled}
              onToggleAiSummary={onToggleAiSummary}
              isScreenSharing={isScreenSharing}
              onToggleScreenShare={onToggleScreenShare}
              captionsEnabled={captionsEnabled}
              captionsSupported={captionsSupported}
              onToggleCaptions={onToggleCaptions}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              onOpenSettings={() => setShowSettingsModal(true)}
              panel={panel}
              onSelectPanel={onSelectPanel}
            />

            {/* Hidden settings modal trigger for mobile controlled via onOpenSettings */}
            <div className="hidden">
              <MeetingViewSettingsModal
                open={showSettingsModal}
                onOpenChange={setShowSettingsModal}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
                captionFontSize={captionFontSize}
                onSelectCaptionFontSize={onSelectCaptionFontSize}
                captionOpacity={captionOpacity}
                onSelectCaptionOpacity={onSelectCaptionOpacity}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right on desktop: Panels Navigation Buttons (Chat, Q&A) & View Settings */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <MeetingPanelButtons
          panel={panel}
          onSelectPanel={onSelectPanel}
        />

        <MeetingViewSettingsModal
          open={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          captionFontSize={captionFontSize}
          onSelectCaptionFontSize={onSelectCaptionFontSize}
          captionOpacity={captionOpacity}
          onSelectCaptionOpacity={onSelectCaptionOpacity}
        />
      </div>
    </footer>
  );
};
