import React from 'react';
import { VideoTile } from './VideoTile';
import { OverflowTile } from './OverflowTile';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

export interface MeetingVideoStageProps {
  participants: MeetingParticipant[];
  currentUserId?: string;
  localStream?: MediaStream | null;
  peers: Record<string, { stream: MediaStream | null; videoEnabled?: boolean; audioEnabled?: boolean }>;
  getParticipantDisplayName: (p: { userId?: string; userName?: string; name?: string }) => string;
  getParticipantAvatar: (p: { userId?: string }) => string | undefined;
  speakerMuted?: boolean;
  selectedSpeaker?: string;
  localCameraOn?: boolean;
  localMicOn?: boolean;
  onOpenParticipants?: () => void;
}

/** Main central stage containing participant video tiles */
export const MeetingVideoStage: React.FC<MeetingVideoStageProps> = ({
  participants,
  currentUserId,
  localStream,
  peers,
  getParticipantDisplayName,
  getParticipantAvatar,
  speakerMuted = false,
  selectedSpeaker,
  localCameraOn,
  localMicOn,
  onOpenParticipants,
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
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => { });
      }
    } catch {
      return;
    }

    const analysers: Record<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }> = {};
    const sources: MediaStreamAudioSourceNode[] = [];

    participants.forEach((p) => {
      if (!p.canSendAudio) return;
      if (p.userId === currentUserId && localMicOn === false) return;

      const stream = p.userId === currentUserId ? localStream : peers[p.userId]?.stream;
      if (!stream) return;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      if (p.userId !== currentUserId && !audioTrack.enabled) return;

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
    const VOICE_THRESHOLD = 3.5;

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
          hangover[userId] = now + 650;
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
        void audioCtx.close().catch(() => { });
      }
    };
  }, [participants, localStream, peers, currentUserId, localMicOn]);

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

  const renderTile = (participant: MeetingParticipant) => {
    const isYou = participant.userId === currentUserId;

    const isCameraActive = isYou
      ? (localCameraOn ?? true)
      : Boolean(peers[participant.userId]?.videoEnabled);

    const isMicMuted = isYou
      ? !(localMicOn ?? true)
      : (!participant.canSendAudio || peers[participant.userId]?.audioEnabled === false);

    const peerState = peers[participant.userId];

    return (
      <VideoTile
        key={participant.userId}
        name={getParticipantDisplayName(participant)}
        avatarUrl={getParticipantAvatar(participant)}
        isYou={isYou}
        host={participant.participantRole === 'HOST'}
        muted={isMicMuted}
        cameraOn={isCameraActive}
        stream={isYou ? localStream : peerState?.stream}
        speakerMuted={speakerMuted}
        selectedSpeaker={selectedSpeaker}
        isSpeaking={Boolean(speakingMap[participant.userId])}
      />
    );
  };

  // Grid overflow setup:
  // Dense grid capacity: 20 slots (19 video tiles + 1 overflow tile, as illustrated in the bottom-left layout)
  const MAX_GRID_TILES = 20;
  const isGridOverflow = orderedParticipants.length > MAX_GRID_TILES;
  const gridVisibleParticipants = isGridOverflow
    ? orderedParticipants.slice(0, MAX_GRID_TILES - 1)
    : orderedParticipants;
  const gridOverflowCount = isGridOverflow
    ? orderedParticipants.length - (MAX_GRID_TILES - 1)
    : 0;

  const count = gridVisibleParticipants.length;

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 lg:p-6 bg-transparent overflow-y-auto w-full h-full transition-all duration-300 ease-in-out">
      {/* 1 Participant: Single Large Center Tile */}
      {count === 1 && (
        <div className="w-full max-w-3xl aspect-video mx-auto my-auto">
          {renderTile(gridVisibleParticipants[0])}
        </div>
      )}

      {/* 2 Participants: 1 Row, 2 Columns */}
      {count === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
        </div>
      )}

      {/* 3 Participants (Top-Right Diagram): 2 on Top Row, 1 Centered on Bottom Row */}
      {count === 3 && (
        <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto my-auto items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {renderTile(gridVisibleParticipants[0])}
            {renderTile(gridVisibleParticipants[1])}
          </div>
          <div className="w-full sm:w-[calc(50%-8px)]">
            {renderTile(gridVisibleParticipants[2])}
          </div>
        </div>
      )}

      {/* 4 Participants (Top-Left Diagram): 2x2 Grid */}
      {count === 4 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-5xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
        </div>
      )}

      {/* 5 or 6 Participants: 3 Columns x 2 Rows */}
      {count > 4 && count <= 6 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 w-full max-w-6xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
        </div>
      )}

      {/* 7 to 9 Participants: 3 Columns x 3 Rows */}
      {count > 6 && count <= 9 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-6xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
        </div>
      )}

      {/* 10 to 16 Participants: 4 Columns */}
      {count > 9 && count <= 16 && !isGridOverflow && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 w-full max-w-7xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
        </div>
      )}

      {/* 17+ Participants (Bottom-Left Diagram): Dense Grid with +N more Overflow Tile */}
      {(count > 16 || isGridOverflow) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 w-full max-w-7xl mx-auto my-auto">
          {gridVisibleParticipants.map(renderTile)}
          {gridOverflowCount > 0 && (
            <OverflowTile
              count={gridOverflowCount}
              onClick={onOpenParticipants}
            />
          )}
        </div>
      )}
    </main>
  );
};
