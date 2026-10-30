import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Crown, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  getAvatarColorByName,
  getAvatarTileBgByName,
  getAvatarSpeakerBorderByName,
} from '@/components/ui/avatar-colors';
import { cn } from '@/lib/utils';

export interface VideoTileProps {
  name: string;
  isYou: boolean;
  host: boolean;
  isVisitor?: boolean;
  muted: boolean;
  cameraOn: boolean;
  stream?: MediaStream | null;
  avatarUrl?: string;
  speakerMuted?: boolean;
  selectedSpeaker?: string;
  isSpeaking?: boolean;
  isScreenShare?: boolean;
  fillContainer?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  meetingTitle?: string;
  meetingTime?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  name,
  isYou,
  host,
  muted,
  cameraOn,
  stream,
  avatarUrl,
  speakerMuted = false,
  selectedSpeaker,
  isSpeaking = false,
  isScreenShare = false,
  fillContainer = false,
  isFullscreen = false,
  onToggleFullscreen,
  meetingTitle,
  meetingTime,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [, setTrackRevision] = useState(0);

  useEffect(() => {
    if (!stream) return;
    const bump = () => {
      setTrackRevision((r) => r + 1);
      if (videoRef.current && stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(() => { });
      }
    };
    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => {
      track.addEventListener('mute', bump);
      track.addEventListener('unmute', bump);
      track.addEventListener('ended', bump);
    });

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener('mute', bump);
        track.removeEventListener('unmute', bump);
        track.removeEventListener('ended', bump);
      });
    };
  }, [stream]);

  const hasLiveTrack = Boolean(
    stream &&
    stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
  );

  const isVideoShowing = Boolean(isScreenShare || (cameraOn && hasLiveTrack && stream));

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => { });
    } else if (videoRef.current && !stream) {
      videoRef.current.srcObject = null;
    }
  }, [stream, isVideoShowing]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isYou || Boolean(speakerMuted);
    }
  }, [isYou, speakerMuted]);

  useEffect(() => {
    const videoEl = videoRef.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (videoEl && !isYou && typeof videoEl.setSinkId === 'function') {
      const sinkId = !selectedSpeaker || selectedSpeaker === 'default' ? '' : selectedSpeaker;
      void videoEl.setSinkId(sinkId).catch(() => { });
    }
  }, [selectedSpeaker, isYou]);

  const avatarTileBg = getAvatarTileBgByName(name);
  const speakerBorder = getAvatarSpeakerBorderByName(name);

  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        setVideoAspect(videoWidth / videoHeight);
      }
    }
  };

  return (
    <div
      style={
        isScreenShare && videoAspect
          ? {
            aspectRatio: `${videoAspect}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: isFullscreen ? (videoAspect >= (window.innerWidth / window.innerHeight) ? '100vw' : 'auto') : '100%',
            height: isFullscreen ? (videoAspect < (window.innerWidth / window.innerHeight) ? '100vh' : 'auto') : '100%',
          }
          : (isScreenShare ? { width: '100%', height: '100%', aspectRatio: '16/9', maxWidth: '100%', maxHeight: '100%' } : undefined)
      }
      className={cn(
        "group relative flex items-center justify-center overflow-hidden rounded-xs text-white transition-all duration-200 shadow-md",
        isScreenShare
          ? "m-auto bg-black border-none size-full"
          : cn(
            "bg-zinc-950",
            fillContainer ? "w-full h-full" : "aspect-video w-full"
          ),
        isVideoShowing
          ? (isSpeaking
            ? speakerBorder
            : (!isScreenShare && "border border-[#27272a]"))
          : (isSpeaking
            ? cn(avatarTileBg, speakerBorder)
            : cn(avatarTileBg, "border border-[#27272a]"))
      )}
    >
      {/* Separate audio element plays peer speech while video is hidden. */}
      {!isYou && stream && (
        <audio
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
              el.play().catch(() => { });
            }
          }}
          autoPlay
          playsInline
          muted={Boolean(speakerMuted)}
          className="hidden"
        />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isYou || Boolean(speakerMuted)}
        data-is-local={isYou ? 'true' : 'false'}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedMetadata}
        onCanPlay={handleLoadedMetadata}
        className={cn(
          'size-full transition-opacity duration-200',
          isScreenShare ? 'object-contain' : 'object-cover',
          isYou && !isScreenShare && !stream?.getVideoTracks()[0]?.label?.toLowerCase().includes('screen') && '-scale-x-100',
          !isVideoShowing && 'opacity-0 pointer-events-none absolute inset-0'
        )}
      />

      {!isVideoShowing && (
        <div className="absolute inset-0 flex size-full items-center justify-center p-4">
          <Avatar className="size-20 rounded-full shadow-xl ring-2 ring-white/10">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className="object-cover" />}
            <AvatarFallback
              name={name}
              className={cn("text-2xl font-bold select-none", getAvatarColorByName(name))}
            >
              {name.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Screen share overlays */}
      {isScreenShare ? (
        <>
          {/* Top-left: Meeting heading and formatted time - visible on hover ONLY in fullscreen mode */}
          {isFullscreen && (meetingTitle || meetingTime) && (
            <div
              className="absolute top-4 left-4 z-30 flex items-center gap-2 rounded-xs px-3 py-1.5 text-xs font-medium text-white bg-black/80 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200"
            >
              {meetingTitle && (
                <span className="font-semibold text-zinc-100 max-w-[200px] sm:max-w-xs truncate">
                  {meetingTitle}
                </span>
              )}
              {meetingTitle && meetingTime && (
                <span className="text-zinc-500 select-none">•</span>
              )}
              {meetingTime && (
                <span className="text-zinc-300 font-mono text-[11px]">
                  {meetingTime}
                </span>
              )}
            </div>
          )}

          {/* Bottom-right: Presenting status (accent colored) and fullscreen icon button (icon-only, no typed text) */}
          <div
            className={cn(
              "absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-xs px-2.5 py-1.5 text-xs font-medium text-white bg-black/80 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto transition-opacity duration-200",
              isFullscreen ? "opacity-0 group-hover:opacity-100 hover:opacity-100" : "opacity-100"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-primary font-semibold">
                {isYou ? 'You presenting' : `${name} presenting`}
              </span>
            </div>

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFullscreen();
                }}
                className="flex items-center justify-center p-1 ml-1 pl-2 border-l border-white/20 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            )}
          </div>
        </>
      ) : (
        /* Normal camera tile bottom-left participant label */
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 max-w-[calc(100%-140px)]">
          <div className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs shadow-xs">
            {host && (
              <Crown
                size={12}
                className="text-amber-400 fill-amber-400/30 shrink-0"
                aria-label="Host"
              />
            )}
            <span className="truncate max-w-[140px] sm:max-w-[220px]">
              {name}{isYou ? ' (You)' : ''}
            </span>
          </div>
        </div>
      )}

      {!isScreenShare && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-30">
          <div className="flex items-center justify-center size-[22px] rounded-sm text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs shadow-xs">
            {speakerMuted ? (
              <Tooltip content="Speaker Output Muted" side="top" align="end">
                <span className="flex items-center text-red-400">
                  <VolumeX size={12} />
                </span>
              </Tooltip>
            ) : (
              <Tooltip content="Speaker Output" side="top" align="end">
                <span className="flex items-center text-zinc-400">
                  <Volume2 size={12} />
                </span>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center justify-center size-[22px] rounded-sm text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs shadow-xs">
            <Tooltip content={muted ? "Microphone Muted" : "Microphone Active"} side="top" align="end">
              <span className="flex items-center">
                {muted ? (
                  <MicOff size={12} className="text-red-400" />
                ) : (
                  <Mic size={12} className="text-zinc-200" />
                )}
              </span>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};
