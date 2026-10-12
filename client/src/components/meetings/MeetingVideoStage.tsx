import React from 'react';
import { MonitorUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoTile } from './VideoTile';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

export type LayoutViewMode = 'grid' | 'focus' | 'compact';

export interface MeetingVideoStageProps {
  screenStream?: MediaStream | null;
  activeScreenSharePeer?: { userId: string; stream: MediaStream } | null;
  onStopScreenShare: () => void;
  participants: MeetingParticipant[];
  currentUserId?: string;
  handRaised: boolean;
  localStream?: MediaStream | null;
  peers: Record<string, { stream: MediaStream; screenSharing?: boolean; videoEnabled?: boolean; audioEnabled?: boolean }>;
  layoutMode: LayoutViewMode;
  getParticipantDisplayName: (p: { userId?: string; userName?: string; name?: string }) => string;
  getParticipantAvatar: (p: { userId?: string }) => string | undefined;
  speakerMuted?: boolean;
  selectedSpeaker?: string;
  localCameraOn?: boolean;
  localMicOn?: boolean;
}

/** Main central stage containing active screen shares and participant video tiles */
export const MeetingVideoStage: React.FC<MeetingVideoStageProps> = ({
  screenStream,
  activeScreenSharePeer,
  onStopScreenShare,
  participants,
  currentUserId,
  handRaised,
  localStream,
  peers,
  layoutMode,
  getParticipantDisplayName,
  getParticipantAvatar,
  speakerMuted = false,
  selectedSpeaker,
  localCameraOn,
  localMicOn,
}) => {
  const [speakingMap, setSpeakingMap] = React.useState<Record<string, boolean>>({});
  const [speakerQueue, setSpeakerQueue] = React.useState<string[]>([]);
  const speakerQueueRef = React.useRef(speakerQueue);
  React.useEffect(() => {
    speakerQueueRef.current = speakerQueue;
  }, [speakerQueue]);

  // Active speaker sound detection via Web Audio Analyser
  React.useEffect(() => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return;
    }

    const analysers: Record<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }> = {};
    const sources: MediaStreamAudioSourceNode[] = [];

    participants.forEach((p) => {
      if (!p.canSendAudio) return;

      const stream = p.userId === currentUserId ? localStream : peers[p.userId]?.stream;
      if (!stream) return;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || !audioTrack.enabled) return;

      try {
        const source = audioCtx!.createMediaStreamSource(stream);
        const analyser = audioCtx!.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        sources.push(source);
        analysers[p.userId] = {
          analyser,
          data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
        };
      } catch {
        // Fallback silently if audio node cannot be instantiated
      }
    });

    let running = true;
    let animId: number;
    let lastDispatchTime = 0;

    // Google Meet Active Speaker Stability & Hysteresis parameters:
    // 1. Energy smoothing (EMA) to filter audio pops and clicks.
    // 2. Minimum hold duration (2500ms): Current speaker cannot be bounced around erratically.
    // 3. Sustained speech requirement (1200ms): A contender must talk steadily to displace the active speaker.
    // 4. Simultaneous speech: All active speakers highlight, but grid tiles remain stably anchored.
    const voiceEnergy: Record<string, number> = {};
    const speechStartTime: Record<string, number> = {};
    const hangover: Record<string, number> = {};
    let currentDominantSpeaker: string | null = speakerQueueRef.current[0] || null;
    let dominantPromotedAt = 0;

    const MIN_HOLD_DURATION_MS = 2500;
    const SUSTAINED_SPEECH_REQUIRED_MS = 1200;
    const VOICE_THRESHOLD = 12;

    const checkAudio = () => {
      if (!running || !audioCtx || audioCtx.state === 'closed') return;

      const now = Date.now();
      const nextSpeaking: Record<string, boolean> = {};

      Object.entries(analysers).forEach(([userId, { analyser, data }]) => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const instantAvg = sum / data.length;

        // Exponential moving average (smooths out instantaneous fluctuations)
        const prevEma = voiceEnergy[userId] || 0;
        const ema = prevEma * 0.75 + instantAvg * 0.25;
        voiceEnergy[userId] = ema;

        // Voice detection threshold & hangover (prevents border flicker)
        if (ema > VOICE_THRESHOLD) {
          hangover[userId] = now + 500;
          if (!speechStartTime[userId]) {
            speechStartTime[userId] = now;
          }
        } else if (now > (hangover[userId] || 0)) {
          speechStartTime[userId] = 0;
        }

        if (hangover[userId] && hangover[userId] > now) {
          nextSpeaking[userId] = true;
        }
      });

      // Throttle React state dispatches to at most every 60ms to eliminate render thrashing
      if (now - lastDispatchTime >= 60) {
        lastDispatchTime = now;

        setSpeakingMap((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(nextSpeaking);
          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((k) => prev[k] === nextSpeaking[k])
          ) {
            return prev;
          }
          return nextSpeaking;
        });

        // Hysteresis Speaker Promotion Logic:
        // Identify the strongest contender who has demonstrated sustained speech
        let bestContenderId: string | null = null;
        let bestContenderEnergy = 0;

        Object.entries(speechStartTime).forEach(([userId, startedAt]) => {
          if (!startedAt) return;
          const speechDuration = now - startedAt;
          if (speechDuration >= SUSTAINED_SPEECH_REQUIRED_MS) {
            const energy = voiceEnergy[userId] || 0;
            if (energy > bestContenderEnergy) {
              bestContenderEnergy = energy;
              bestContenderId = userId;
            }
          }
        });

        const isCurrentStillSpeaking = Boolean(currentDominantSpeaker && nextSpeaking[currentDominantSpeaker]);
        const isHoldExpired = now - dominantPromotedAt >= MIN_HOLD_DURATION_MS;

        // Switch dominant speaker only if hold expired or current speaker is silent
        const canSwitch = !currentDominantSpeaker || isHoldExpired || !isCurrentStillSpeaking;

        if (bestContenderId && bestContenderId !== currentDominantSpeaker && canSwitch) {
          currentDominantSpeaker = bestContenderId;
          dominantPromotedAt = now;

          setSpeakerQueue((prev) => {
            if (prev[0] === bestContenderId) return prev;
            const filtered = prev.filter((id) => id !== bestContenderId);
            return [bestContenderId!, ...filtered];
          });
        }
      }

      animId = requestAnimationFrame(checkAudio);
    };

    checkAudio();

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      sources.forEach((s) => {
        try {
          s.disconnect();
        } catch {
          // Ignore disconnect error on tear down
        }
      });
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => {});
      }
    };
  }, [participants, localStream, peers, currentUserId]);

  // Sort participants by speakerQueue order: active speaker is 1st, others slowly queue back
  const orderedParticipants = React.useMemo(() => {
    if (!speakerQueue.length) return participants;
    const participantMap = new Map(participants.map((p) => [p.userId, p]));
    const result: MeetingParticipant[] = [];

    // Push in active speaker queue order
    for (const id of speakerQueue) {
      const p = participantMap.get(id);
      if (p) {
        result.push(p);
        participantMap.delete(id);
      }
    }
    // Remaining participants follow in natural roster order
    for (const p of participantMap.values()) {
      result.push(p);
    }
    return result;
  }, [participants, speakerQueue]);

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 bg-muted/20 overflow-y-auto w-full transition-all duration-300 ease-in-out">
      {/* Active Screen Share Stage (Host or Participant) */}
      {(screenStream || activeScreenSharePeer) && (
        <div className="w-full max-w-4xl space-y-2 mb-2">
          <div className="flex items-center justify-between bg-slate-900 border border-emerald-500/40 rounded-t-xs px-4 py-2 text-xs text-white">
            <span className="flex items-center gap-2 font-bold text-emerald-400">
              <MonitorUp size={15} />
              {screenStream
                ? 'You are sharing your screen'
                : `${getParticipantDisplayName({ userId: activeScreenSharePeer?.userId || '' })} is sharing screen`}
            </span>
            {screenStream && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onStopScreenShare}
                className="h-7 text-xs px-2.5 cursor-pointer rounded-xs"
              >
                Stop Sharing
              </Button>
            )}
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-b-xs border border-slate-800 bg-black shadow-2xl">
            <video
              ref={(el) => {
                if (el) {
                  el.srcObject = screenStream || activeScreenSharePeer?.stream || null;
                }
              }}
              autoPlay
              playsInline
              muted={Boolean(screenStream)}
              className="size-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Participant Video Tiles Grid */}
      <div
        className={`grid w-full max-w-4xl gap-4 ${
          layoutMode === 'focus'
            ? 'grid-cols-1'
            : layoutMode === 'compact'
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {orderedParticipants.map((participant) => {
          const isYou = participant.userId === currentUserId;
          const isSharingScreen = isYou
            ? Boolean(screenStream)
            : Boolean(peers[participant.userId]?.screenSharing || activeScreenSharePeer?.userId === participant.userId);

          const isCameraActive = isYou
            ? (localCameraOn ?? true)
            : (peers[participant.userId]?.videoEnabled ?? participant.canSendVideo);

          const isMicMuted = isYou
            ? !(localMicOn ?? true)
            : (!participant.canSendAudio || peers[participant.userId]?.audioEnabled === false);

          return (
            <VideoTile
              key={participant.userId}
              name={getParticipantDisplayName(participant)}
              avatarUrl={getParticipantAvatar(participant)}
              isYou={isYou}
              host={participant.participantRole === 'HOST'}
              muted={isMicMuted}
              cameraOn={isCameraActive}
              handRaised={isYou ? handRaised : false}
              stream={isYou ? localStream : peers[participant.userId]?.stream}
              speakerMuted={speakerMuted}
              selectedSpeaker={selectedSpeaker}
              screenSharing={isSharingScreen}
              isSpeaking={Boolean(speakingMap[participant.userId])}
            />
          );
        })}
      </div>
    </main>
  );
};
