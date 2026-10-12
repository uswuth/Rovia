import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Hand, Crown, Volume2, VolumeX, MonitorUp } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColorByName, getAvatarTileBgByName } from '@/components/ui/avatar-colors';
import { cn } from '@/lib/utils';

export interface VideoTileProps {
  name: string;
  isYou: boolean;
  host: boolean;
  isVisitor?: boolean;
  muted: boolean;
  cameraOn: boolean;
  stream?: MediaStream | null;
  handRaised?: boolean;
  avatarUrl?: string;
  speakerMuted?: boolean;
  selectedSpeaker?: string;
  screenSharing?: boolean;
  isSpeaking?: boolean;
}

/** One participant video tile with camera/audio states, active speaker border, and hand-raise indicator. */
export const VideoTile: React.FC<VideoTileProps> = ({
  name,
  isYou,
  host,
  muted,
  cameraOn,
  stream,
  handRaised,
  avatarUrl,
  speakerMuted = false,
  selectedSpeaker,
  screenSharing = false,
  isSpeaking = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasLiveTrack, setHasLiveTrack] = useState<boolean>(() => {
    return Boolean(
      cameraOn &&
      stream &&
      stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
    );
  });

  useEffect(() => {
    if (!cameraOn || !stream) {
      return;
    }

    const check = () => {
      const active = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
      setHasLiveTrack(active);
    };

    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => {
      track.addEventListener('mute', check);
      track.addEventListener('unmute', check);
      track.addEventListener('ended', check);
    });

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener('mute', check);
        track.removeEventListener('unmute', check);
        track.removeEventListener('ended', check);
      });
      setHasLiveTrack(false);
    };
  }, [cameraOn, stream]);

  const isVideoShowing = Boolean(cameraOn && hasLiveTrack && stream);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs text-white shadow-lg transition-all duration-300 bg-slate-950",
        isVideoShowing
          ? (isSpeaking
              ? "border-2 border-emerald-500 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/40"
              : "border border-slate-800")
          : (isSpeaking
              ? cn(avatarTileBg, "border-2 border-emerald-500 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/40")
              : avatarTileBg)
      )}
    >
      {/* ALWAYS render video element so audio track plays even when camera is off */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isYou || Boolean(speakerMuted)}
        data-is-local={isYou ? 'true' : 'false'}
        className={isVideoShowing ? 'size-full object-cover -scale-x-100' : 'invisible absolute pointer-events-none size-0'}
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
        <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs shadow-xs">
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
        <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs shadow-xs">
          {screenSharing && (
            <Tooltip content="Sharing Screen" side="top" align="end">
              <span className="flex items-center text-emerald-400">
                <MonitorUp size={12} />
              </span>
            </Tooltip>
          )}

          {speakerMuted ? (
            <Tooltip content="Speaker Output Muted" side="top" align="end">
              <span className="flex items-center text-red-400">
                <VolumeX size={12} />
              </span>
            </Tooltip>
          ) : (
            <Tooltip content={isSpeaking ? "Audio Output Active" : "Speaker Output"} side="top" align="end">
              <span className={cn("flex items-center", isSpeaking ? "text-emerald-400" : "text-slate-400")}>
                <Volume2 size={12} />
              </span>
            </Tooltip>
          )}

          <Tooltip content={muted ? "Microphone Muted" : isSpeaking ? "Speaking" : "Microphone Active"} side="top" align="end">
            <span className="flex items-center">
              {muted ? (
                <MicOff size={12} className="text-red-400" />
              ) : (
                <Mic size={12} className={isSpeaking ? "text-emerald-400" : "text-slate-300"} />
              )}
            </span>
          </Tooltip>
        </div>
      </div>

      {/* Top right active hand-raise status */}
      {handRaised && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <Tooltip content="Hand Raised" side="left">
            <span
              className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-md animate-bounce"
            >
              <Hand size={14} />
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
