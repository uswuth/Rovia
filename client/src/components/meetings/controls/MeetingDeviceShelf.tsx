import React from 'react';
import {
  Mic,
  Video,
  VideoOff,
  Volume1,
  Volume2,
  VolumeX,
  Play,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { getCleanDeviceLabel, type ShelfType } from './device-utils';

export interface MeetingDeviceShelfProps {
  activeShelf: ShelfType;
  shelfRef: React.RefObject<HTMLDivElement | null>;
  deviceDropdownOpen: boolean;
  setDeviceDropdownOpen: (open: boolean) => void;
  // Mic
  audioInputs: MediaDeviceInfo[];
  selectedMic: string;
  onSelectMic: (id: string) => void;
  currentMicLabel: string;
  micOn: boolean;
  micVolume: number;
  setMicVolume: (vol: number) => void;
  liveMicLevel: number;
  micTestStage: 'idle' | 'countdown' | 'recording' | 'ready_to_play' | 'playing' | 'done';
  micCountdown: number;
  handleTestMic: () => void;
  // Speaker
  audioOutputs: MediaDeviceInfo[];
  selectedSpeaker: string;
  onSelectSpeaker: (id: string) => void;
  currentSpeakerLabel: string;
  speakerOn: boolean;
  speakerVolume: number;
  setSpeakerVolume: (vol: number) => void;
  liveSpeakerLevel: number;
  isTestingSpeaker: boolean;
  handleTestSpeaker: () => void;
  // Camera
  videoInputs: MediaDeviceInfo[];
  selectedCamera: string;
  onSelectCamera: (id: string) => void;
  currentCameraLabel: string;
  isTestingCamera: boolean;
  setIsTestingCamera: (testing: boolean | ((prev: boolean) => boolean)) => void;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
  isCameraLoading: boolean;
  cameraPreviewError: string | null;
  previewStream: MediaStream | null;
}

export const MeetingDeviceShelf: React.FC<MeetingDeviceShelfProps> = ({
  activeShelf,
  shelfRef,
  deviceDropdownOpen,
  setDeviceDropdownOpen,
  audioInputs,
  selectedMic,
  onSelectMic,
  currentMicLabel,
  micOn,
  micVolume,
  setMicVolume,
  liveMicLevel,
  micTestStage,
  micCountdown,
  handleTestMic,
  audioOutputs,
  selectedSpeaker,
  onSelectSpeaker,
  currentSpeakerLabel,
  speakerOn,
  speakerVolume,
  setSpeakerVolume,
  liveSpeakerLevel,
  isTestingSpeaker,
  handleTestSpeaker,
  videoInputs,
  selectedCamera,
  onSelectCamera,
  currentCameraLabel,
  isTestingCamera,
  setIsTestingCamera,
  videoPreviewRef,
  isCameraLoading,
  cameraPreviewError,
  previewStream,
}) => {
  if (!activeShelf) return null;

  return (
    <div
      ref={shelfRef}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[min(360px,calc(100vw-24px))] sm:w-[540px] max-w-[92vw] bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-xs px-3.5 py-2.5 z-40 animate-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-center justify-between gap-3 w-full">
        {/* 1. Microphone Shelf */}
        {activeShelf === 'mic' && (
          <>
            <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-44 sm:max-w-52 shrink-0"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Mic size={14} className="text-primary shrink-0" />
                      <span className="truncate">{currentMicLabel}</span>
                    </span>
                    <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                  </button>
                }
              />
              <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-popover text-popover-foreground shadow-xl rounded-xs" align="start">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border/80 mb-1">
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
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <span className="truncate flex-1 mr-2">{lbl}</span>
                          {isSelected && <Check size={14} className="text-primary shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-xs text-muted-foreground p-2">Default Microphone</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleTestMic}
                disabled={micTestStage === 'countdown' || micTestStage === 'recording'}
                className={cn(
                  "h-7 w-[96px] sm:w-[104px] justify-center text-xs gap-1 cursor-pointer font-medium rounded-xs px-2 shrink-0 transition-all",
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

              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
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
                  className="w-20 sm:w-24"
                />
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{micVolume}%</span>
              </div>

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
            <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-44 sm:max-w-52 shrink-0"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {!speakerOn || speakerVolume === 0 ? (
                        <VolumeX size={14} className="text-primary shrink-0" />
                      ) : speakerVolume <= 50 ? (
                        <Volume1 size={14} className="text-primary shrink-0" />
                      ) : (
                        <Volume2 size={14} className="text-primary shrink-0" />
                      )}
                      <span className="truncate">{currentSpeakerLabel}</span>
                    </span>
                    <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                  </button>
                }
              />
              <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-popover text-popover-foreground shadow-xl rounded-xs" align="start">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border/80 mb-1">
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
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <span className="truncate flex-1 mr-2">{lbl}</span>
                          {isSelected && <Check size={14} className="text-primary shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-xs text-muted-foreground p-2">Default Speaker</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleTestSpeaker}
                disabled={isTestingSpeaker}
                className="h-7 w-16 sm:w-20 justify-center text-xs gap-1 cursor-pointer font-medium hover:bg-secondary rounded-xs px-2 shrink-0"
              >
                <Play size={10} className={cn("text-emerald-500 fill-emerald-500 shrink-0", isTestingSpeaker && "animate-pulse")} />
                <span className="truncate">{isTestingSpeaker ? 'Testing...' : 'Test'}</span>
              </Button>

              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
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
                  className="w-20 sm:w-24"
                />
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right shrink-0">{speakerVolume}%</span>
              </div>

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
            {isTestingCamera && (
              <div className="relative w-full h-40 sm:h-44 bg-zinc-950 rounded-xs overflow-hidden border border-border shadow-xs flex items-center justify-center animate-in fade-in duration-200">
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

            <div className="flex items-center justify-between gap-3 w-full">
              <Popover open={deviceDropdownOpen} onOpenChange={setDeviceDropdownOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-medium cursor-pointer transition-colors max-w-44 sm:max-w-56"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Video size={14} className="text-primary shrink-0" />
                        <span className="truncate">{currentCameraLabel}</span>
                      </span>
                      <ChevronDown size={13} className="text-muted-foreground shrink-0 ml-1" />
                    </button>
                  }
                />
                <PopoverContent side="top" sideOffset={8} className="w-64 p-2 space-y-1 border-border bg-popover text-popover-foreground shadow-xl rounded-xs" align="start">
                  <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 border-b border-border/80 mb-1">
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
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <span className="truncate flex-1 mr-2">{lbl}</span>
                            {isSelected && <Check size={14} className="text-primary shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground p-2">Default Camera</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                variant={isTestingCamera ? "destructive" : "outline"}
                size="sm"
                onClick={() => setIsTestingCamera((prev) => !prev)}
                className="h-8 text-xs gap-1.5 font-medium px-2 sm:px-3 cursor-pointer shrink-0"
              >
                {isTestingCamera ? (
                  <>
                    <VideoOff size={13} className="shrink-0" />
                    <span>Stop Preview</span>
                  </>
                ) : (
                  <>
                    <Play size={11} className="text-emerald-500 fill-emerald-500 shrink-0" />
                    <span>Test Preview</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
