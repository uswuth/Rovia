import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Crown, Volume2, VolumeX } from 'lucide-react';
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
}

/** One participant video tile with camera/audio states, active speaker border, and screen sharing indicator. */
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [, setTrackRevision] = useState(0);

  useEffect(() => {
    if (!stream) return;
    const bump = () => setTrackRevision((r) => r + 1);
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

  const isVideoShowing = Boolean(cameraOn && hasLiveTrack && stream);

  useEffect(() => {
    if (videoRef.current) {
      if (isVideoShowing && stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
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
      void videoEl.setSinkId(sinkId).catch(() => {});
    }
  }, [selectedSpeaker, isYou]);

  const avatarTileBg = getAvatarTileBgByName(name);
  const speakerBorder = getAvatarSpeakerBorderByName(name);

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs text-white transition-all duration-200 bg-zinc-950 shadow-md",
        isVideoShowing
          ? (isSpeaking
              ? speakerBorder
              : "border border-[#27272a]")
          : (isSpeaking
              ? cn(avatarTileBg, speakerBorder)
              : cn(avatarTileBg, "border border-[#27272a]"))
      )}
    >
      {/* Hidden audio element ensures peer speech is audible without exposing disabled video frames */}
      {!isYou && stream && (
        <audio
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
          muted={Boolean(speakerMuted)}
          className="hidden"
        />
      )}

      {/* Video element only exists when video is explicitly showing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isYou || Boolean(speakerMuted)}
        data-is-local={isYou ? 'true' : 'false'}
        className={isVideoShowing ? cn('size-full object-cover', isYou && '-scale-x-100') : 'hidden'}
      />

      {!isVideoShowing && (
        <div className="flex size-full items-center justify-center p-4">
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

      {/* Name tag at bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10 max-w-[calc(100%-140px)]">
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs shadow-xs">
          {host && (
            <Crown
              size={12}
              className="text-amber-400 fill-amber-400/30 shrink-0"
              aria-label="Host"
            />
          )}
          <span className="truncate max-w-[140px] sm:max-w-[180px]">
            {name}{isYou ? ' (You)' : ''}
          </span>
        </div>
      </div>

      {/* Mic, Speaker, and Screen Share icons on bottom-right (outside the name tag) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-30">
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white bg-black/60 backdrop-blur-xs shadow-xs">
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
    </div>
  );
};
