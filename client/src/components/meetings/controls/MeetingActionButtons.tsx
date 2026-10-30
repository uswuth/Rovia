import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume1,
  Volume2,
  VolumeX,
  PhoneOff,
  Hand,
  ChevronUp,
  ChevronDown,
  ScreenShare,
  ScreenShareOff,
  Captions,
  CaptionsOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export interface MeetingActionButtonsProps {
  // Mic
  micOn: boolean;
  onToggleMic: () => void;
  activeShelf: 'mic' | 'camera' | 'speaker' | null;
  onToggleShelf: (shelf: 'mic' | 'camera' | 'speaker') => void;
  // Camera
  cameraOn: boolean;
  onToggleCamera: () => void;
  // Speaker
  speakerOn: boolean;
  speakerVolume: number;
  onToggleSpeaker: () => void;
  // Screen Share
  isScreenSharing?: boolean;
  onToggleScreenShare?: () => void;
  // Hand
  handRaised: boolean;
  onToggleHandRaise: () => void;
  // Captions
  captionsEnabled?: boolean;
  captionsSupported?: boolean;
  onToggleCaptions?: () => void;
  // Leave
  onLeaveClick: () => void;
}

export const MeetingActionButtons: React.FC<MeetingActionButtonsProps> = ({
  micOn,
  onToggleMic,
  activeShelf,
  onToggleShelf,
  cameraOn,
  onToggleCamera,
  speakerOn,
  speakerVolume,
  onToggleSpeaker,
  isScreenSharing,
  onToggleScreenShare,
  handRaised,
  onToggleHandRaise,
  captionsEnabled,
  captionsSupported,
  onToggleCaptions,
  onLeaveClick,
}) => {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
      {/* Mic Split Button */}
      <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
        <Tooltip content={micOn ? 'Mute Mic (Alt+C)' : 'Unmute Mic (Alt+C)'} side="top">
          <button
            type="button"
            onClick={onToggleMic}
            className={`flex size-7 sm:size-9 w-7 sm:w-9 h-7 sm:h-9 min-w-7 sm:min-w-9 min-h-7 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
              micOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {micOn ? <Mic size={14} className="sm:w-4 sm:h-4" /> : <MicOff size={14} className="sm:w-4 sm:h-4" />}
          </button>
        </Tooltip>
        <Tooltip content={activeShelf === 'mic' ? 'Close Mic Settings' : 'Microphone Settings'} side="top">
          <button
            type="button"
            onClick={() => onToggleShelf('mic')}
            className="flex size-5 sm:size-7 w-5 sm:w-7 h-5 sm:h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Microphone Settings"
          >
            {activeShelf === 'mic' ? <ChevronDown size={11} className="sm:w-3.5 sm:h-3.5" /> : <ChevronUp size={11} className="sm:w-3.5 sm:h-3.5" />}
          </button>
        </Tooltip>
      </div>

      {/* Camera Split Button */}
      <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
        <Tooltip content={cameraOn ? 'Turn Camera Off (Alt+V)' : 'Turn Camera On (Alt+V)'} side="top">
          <button
            type="button"
            onClick={onToggleCamera}
            className={`flex size-7 sm:size-9 w-7 sm:w-9 h-7 sm:h-9 min-w-7 sm:min-w-9 min-h-7 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
              cameraOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {cameraOn ? <Video size={14} className="sm:w-4 sm:h-4" /> : <VideoOff size={14} className="sm:w-4 sm:h-4" />}
          </button>
        </Tooltip>
        <Tooltip content={activeShelf === 'camera' ? 'Close Camera Settings' : 'Camera Settings'} side="top">
          <button
            type="button"
            onClick={() => onToggleShelf('camera')}
            className="flex size-5 sm:size-7 w-5 sm:w-7 h-5 sm:h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Camera Settings"
          >
            {activeShelf === 'camera' ? <ChevronDown size={11} className="sm:w-3.5 sm:h-3.5" /> : <ChevronUp size={11} className="sm:w-3.5 sm:h-3.5" />}
          </button>
        </Tooltip>
      </div>

      {/* Speaker Split Button */}
      <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs shrink-0">
        <Tooltip content={speakerOn && speakerVolume > 0 ? 'Deafen / Mute Speaker (Alt+B)' : 'Undeafen Speaker (Alt+B)'} side="top">
          <button
            type="button"
            onClick={onToggleSpeaker}
            className={`flex size-7 sm:size-9 w-7 sm:w-9 h-7 sm:h-9 min-w-7 sm:min-w-9 min-h-7 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full transition-colors cursor-pointer ${
              speakerOn && speakerVolume > 0 ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {!speakerOn || speakerVolume === 0 ? (
              <VolumeX size={14} className="sm:w-4 sm:h-4" />
            ) : speakerVolume <= 50 ? (
              <Volume1 size={14} className="sm:w-4 sm:h-4" />
            ) : (
              <Volume2 size={14} className="sm:w-4 sm:h-4" />
            )}
          </button>
        </Tooltip>
        <Tooltip content={activeShelf === 'speaker' ? 'Close Speaker Settings' : 'Speaker Settings'} side="top">
          <button
            type="button"
            onClick={() => onToggleShelf('speaker')}
            className="flex size-5 sm:size-7 w-5 sm:w-7 h-5 sm:h-7 shrink-0 aspect-square items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Speaker Settings"
          >
            {activeShelf === 'speaker' ? <ChevronDown size={11} className="sm:w-3.5 sm:h-3.5" /> : <ChevronUp size={11} className="sm:w-3.5 sm:h-3.5" />}
          </button>
        </Tooltip>
      </div>

      {/* Screen Share Button - desktop only, mobile is in MobileMoreMenu */}
      {onToggleScreenShare && (
        <div className="hidden sm:flex">
          <Tooltip content={isScreenSharing ? 'Stop Presenting Screen' : 'Share Screen'} side="top">
            <button
              type="button"
              onClick={onToggleScreenShare}
              className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${
                isScreenSharing
                  ? 'bg-accent text-accent-foreground border-accent shadow-md scale-105'
                  : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
              aria-label={isScreenSharing ? 'Stop Presenting Screen' : 'Share Screen'}
            >
              {isScreenSharing ? <ScreenShareOff size={16} /> : <ScreenShare size={16} />}
            </button>
          </Tooltip>
        </div>
      )}

      {/* Hand Raise Button */}
      <Tooltip content={handRaised ? 'Lower Hand' : 'Raise Hand'} side="top">
        <button
          type="button"
          onClick={onToggleHandRaise}
          className={`flex size-8 sm:size-9 w-8 sm:w-9 h-8 sm:h-9 min-w-8 sm:min-w-9 min-h-8 sm:min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border transition-all cursor-pointer ${
            handRaised
              ? 'bg-accent text-accent-foreground border-accent shadow-md scale-105'
              : 'border-border bg-card text-foreground hover:bg-secondary'
          }`}
        >
          <Hand size={14} className="sm:w-4 sm:h-4" />
        </button>
      </Tooltip>

      {/* Live Captions (Subtitles) Button - desktop only, mobile is in MobileMoreMenu */}
      {onToggleCaptions && (
        <div className="hidden sm:flex">
          <Tooltip
            content={
              !captionsSupported
                ? 'Captions not supported or blocked in this browser (Use Chrome/Edge)'
                : captionsEnabled
                ? 'Turn off captions'
                : 'Turn on captions'
            }
            side="top"
          >
            <button
              type="button"
              onClick={captionsSupported ? onToggleCaptions : undefined}
              disabled={!captionsSupported}
              className={`flex size-9 w-9 h-9 min-w-9 min-h-9 shrink-0 aspect-square items-center justify-center rounded-full border transition-all ${
                !captionsSupported
                  ? 'border-border/40 bg-muted/40 text-muted-foreground/50 cursor-not-allowed opacity-60'
                  : captionsEnabled
                  ? 'bg-primary/15 text-primary border-primary/40 font-bold cursor-pointer'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer'
              }`}
              aria-label="Toggle Live Captions"
            >
              {captionsEnabled && captionsSupported ? <Captions size={16} /> : <CaptionsOff size={16} />}
            </button>
          </Tooltip>
        </div>
      )}

      {/* Leave Button */}
      <Button
        variant="destructive"
        className="rounded-full px-2.5 sm:px-4 h-8 sm:h-9 shrink-0 font-bold gap-1 shadow-md cursor-pointer text-xs"
        onClick={onLeaveClick}
      >
        <PhoneOff size={13} className="sm:w-3.5 sm:h-3.5" />
        <span className="hidden xs:inline sm:inline">Leave</span>
      </Button>
    </div>
  );
};
