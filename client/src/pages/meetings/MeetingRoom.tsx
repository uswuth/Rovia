import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery, useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { parseApiError } from '@/utils/apiError';
import {
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  endMeeting,
  previewMeetingByJoinCode,
} from '@/api/meeting/meeting.api';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import { useWebRtcMeeting } from '@/hooks/useWebRtcMeeting';
import { useLiveCaptions } from '@/hooks/useLiveCaptions';
import type { Meeting, MeetingParticipant, MeetingParticipantRaw, MeetingPreview } from '@/api/meeting/meeting.types';
import { normalizeParticipants } from '@/api/meeting/meeting.types';
import type { MeetingChatMessage, RaisedHand } from '@/api/meeting/webrtc.types';

import { MeetingHeader } from '@/components/meetings/MeetingHeader';
import { MeetingVideoStage } from '@/components/meetings/MeetingVideoStage';
import { MeetingControls, type PanelKey } from '@/components/meetings/MeetingControls';
import { MeetingSidebar } from '@/components/meetings/MeetingSidebar';
import { MeetingLeaveModal } from '@/components/meetings/MeetingLeaveModal';
import { MeetingEndedModal } from '@/components/meetings/MeetingEndedModal';
import { ParticipantSettingsModal, type ParticipantPermissions } from '@/components/meetings/ParticipantSettingsModal';
import { shareOrCopy } from '@/lib/share';
import { cn } from '@/lib/utils';

import { useMeetingParticipantResolver } from '@/components/meetings/room/useMeetingParticipantResolver';
import { useMeetingMediaDevices } from '@/components/meetings/room/useMeetingMediaDevices';
import { useMeetingQaAndPolls } from '@/components/meetings/room/useMeetingQaAndPolls';
import { useMeetingShortcuts } from '@/components/meetings/room/useMeetingShortcuts';
import { useMeetingSocketEvents } from '@/components/meetings/room/useMeetingSocketEvents';

export const MeetingRoom: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [panel, setPanel] = useState<PanelKey | null>('people');
  const [renderedPanel, setRenderedPanel] = useState<PanelKey | null>('people');

  const handleSetPanel = useCallback((p: PanelKey | null) => {
    setPanel(p);
    if (p) {
      setRenderedPanel(p);
    }
  }, []);

  const [editing, setEditing] = useState<MeetingParticipant | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);

  const locationState = location.state as {
    fromLobby?: boolean;
    initialCamera?: boolean;
    initialMic?: boolean;
    selectedMic?: string;
    selectedCamera?: string;
    selectedSpeaker?: string;
    preview?: MeetingPreview;
  } | null;

  const [micOn, setMicOn] = useState(() => locationState?.initialMic ?? false);
  const [cameraOn, setCameraOn] = useState(() => locationState?.initialCamera ?? true);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const isMyHandRaised = raisedHands.some((h) => h.userId === user?.userId);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [captionFontSize, setCaptionFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [captionOpacity, setCaptionOpacity] = useState<20 | 40 | 60 | 80 | 100>(80);
  const [meetingEndedByHost, setMeetingEndedByHost] = useState(false);
  const [speakerOn, setSpeakerOn] = useState<boolean>(true);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const { data: meeting, loading, error, refetch } = useQuery<Meeting>(
    queryKeys.meetings.detail(id),
    async () => {
      if (isAuthenticated) {
        return getMeetingById(id);
      }
      const preview = (location.state as { preview?: { meetingJoinCode?: string } } | null)?.preview;
      const code = preview?.meetingJoinCode;
      if (code) {
        const res = await previewMeetingByJoinCode(code);
        const data = res.data.data;
        const meetingObj: Meeting = {
          meetingId: data.meetingId,
          meetingTitle: data.meetingTitle,
          meetingDescription: data.meetingDescription || '',
          meetingStatus: data.meetingStatus,
          meetingJoinMode: data.meetingJoinMode,
          meetingScheduledAt: data.meetingScheduledAt,
          meetingDurationMinutes: data.meetingDurationMinutes,
          meetingParticipantLimit: data.meetingParticipantLimit,
          meetingJoinCode: data.meetingJoinCode || code,
          organizationId: '',
          projectId: '',
          createdBy: '',
          participants: data.participants || [],
        };
        return { data: { data: meetingObj } };
      }
      throw new Error('Meeting join code not found');
    },
    { enabled: Boolean(id) && isAuthenticated }
  );

  const {
    getParticipantDisplayName,
    getParticipantAvatar,
    getParticipantEmail,
    getParticipantMeetingRole,
  } = useMeetingParticipantResolver({
    meeting,
    userId: user?.userId,
    userName: user?.userName,
    userEmail: user?.userEmail,
    userAvatarUrl: user?.avatarUrl,
  });

  useEffect(() => {
    if (id && isAuthenticated) {
      joinMeeting(id).then(() => {
        void refetch();
      }).catch(() => { });
    }
  }, [id, isAuthenticated, refetch]);

  const rtc = useWebRtcMeeting(id, Boolean(id) && isAuthenticated, {
    initialAudioDeviceId: locationState?.selectedMic,
    initialVideoDeviceId: locationState?.selectedCamera,
    initialMic: micOn,
    initialCamera: cameraOn,
    onPeerJoined: () => {
      void refetch();
    },
    onPeerLeft: (leftUserId) => {
      const leftName = getParticipantDisplayName({ userId: leftUserId });
      showToast(`${leftName} left`);
      void refetch();
    },
  });

  const {
    audioInputs,
    audioOutputs,
    videoInputs,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    selectedCamera,
    setSelectedCamera,
  } = useMeetingMediaDevices({
    initialMicDeviceId: locationState?.selectedMic,
    initialCameraDeviceId: locationState?.selectedCamera,
    initialSpeakerDeviceId: locationState?.selectedSpeaker,
    localStream: rtc.localStream,
  });

  const captions = useLiveCaptions({
    meetingId: id,
    currentUserId: user?.userId,
    currentUserName: user?.userName,
    micOn,
  });

  useEffect(() => {
    if (captions.recognitionError) {
      const isRecoverable = captions.recognitionError === 'network';
      const msg = isRecoverable
        ? `Captions paused: ${captions.recognitionError}. Retrying…`
        : `Captions unavailable: ${captions.recognitionError}. Check permissions.`;
      const t = setTimeout(() => showToast(msg), 0);
      return () => clearTimeout(t);
    }
  }, [captions.recognitionError, showToast]);

  useEffect(() => {
    const handleUnload = () => {
      if (id) {
        import('@/api/meeting/meeting-socket').then((m) => {
          m.getMeetingSocket().emit('meeting:leave', id);
        }).catch(() => { });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [id]);

  const {
    questions,
    polls,
    qaPending,
    pollPending,
    handleAskQuestion,
    handleAnswerQuestion,
    handleDismissQuestion,
    handleCreatePoll,
    handleVotePoll,
    handleClosePoll,
  } = useMeetingQaAndPolls({
    meetingId: id,
    isQaPanelOpen: panel === 'qa',
    showToast,
  });

  useMeetingSocketEvents({
    meetingId: id,
    isAuthenticated,
    queryClient,
    userId: user?.userId,
    refetchMeeting: () => { void refetch(); },
    refetchQuestions: () => { void questions.refetch(); },
    onMeetingEnded: () => setMeetingEndedByHost(true),
    onParticipantMutedByHost: () => {
      setMicOn(false);
      rtc.setAudioEnabled(false);
      showToast('You were muted by the host');
    },
    onParticipantCameraOffByHost: () => {
      setCameraOn(false);
      rtc.setVideoEnabled(false);
      showToast('Your camera was turned off by the host');
    },
    onChatMessageReceived: (message) => {
      setChatMessages((prev) => (prev.some((m) => m.messageId === message.messageId) ? prev : [...prev, message]));
    },
    onHandsUpdated: (hands) => setRaisedHands(hands),
  });

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  const handleToggleMic = useCallback(() => {
    setMicOn((on) => {
      const next = !on;
      rtc.setAudioEnabled(next);
      showToast(next ? 'Microphone unmuted (Alt+C)' : 'Microphone muted (Alt+C)');
      return next;
    });
  }, [rtc, showToast]);

  const handleToggleCamera = useCallback(() => {
    setCameraOn((on) => {
      const next = !on;
      rtc.setVideoEnabled(next);
      showToast(next ? 'Camera turned on (Alt+V)' : 'Camera turned off (Alt+V)');
      return next;
    });
  }, [rtc, showToast]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      const next = !on;
      const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
      for (const el of mediaElements) {
        if (el.dataset.isLocal !== 'true') {
          el.muted = !next;
        }
      }
      showToast(next ? 'Audio undeafened (Alt+B)' : 'Audio deafened (Alt+B)');
      return next;
    });
  }, [showToast]);

  const handleMuteAllThree = useCallback(() => {
    if (micOn || cameraOn || speakerOn) {
      setMicOn(false);
      rtc.setAudioEnabled(false);

      setCameraOn(false);
      rtc.setVideoEnabled(false);

      setSpeakerOn(false);
      const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
      for (const el of mediaElements) {
        if (el.dataset.isLocal !== 'true') {
          el.muted = true;
        }
      }
      showToast('Muted all (Mic, Camera, and Audio off)');
    } else {
      setMicOn(true);
      rtc.setAudioEnabled(true);

      setCameraOn(true);
      rtc.setVideoEnabled(true);

      setSpeakerOn(true);
      const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
      for (const el of mediaElements) {
        if (el.dataset.isLocal !== 'true') {
          el.muted = false;
        }
      }
      showToast('Unmuted all (Mic, Camera, and Audio on)');
    }
  }, [micOn, cameraOn, speakerOn, rtc, showToast]);

  useMeetingShortcuts({
    onToggleMic: handleToggleMic,
    onToggleCamera: handleToggleCamera,
    onToggleSpeaker: handleToggleSpeaker,
    onMuteAllThree: handleMuteAllThree,
  });

  const handleToggleHandRaise = useCallback(() => {
    const isRaised = raisedHands.some((h) => h.userId === user?.userId);
    const next = !isRaised;
    getMeetingSocket().emit('meeting:hand-raise', {
      meetingId: id,
      raised: next,
      userName: user?.userName || 'You',
    });
    showToast(next ? 'Hand raised' : 'Hand lowered');
  }, [id, raisedHands, showToast, user?.userId, user?.userName]);

  const handleLowerHand = useCallback((targetUserId?: string) => {
    getMeetingSocket().emit('meeting:hand-lower', {
      meetingId: id,
      userId: targetUserId,
    });
  }, [id]);

  const toggleParticipantsPanel = useCallback(() => {
    setPanel((current) => {
      const next = current === 'people' ? null : 'people';
      if (next) {
        setRenderedPanel(next);
      }
      return next;
    });
  }, []);

  const participants = useMemo(() => {
    return normalizeParticipants((meeting?.participants ?? []) as unknown as MeetingParticipantRaw[]);
  }, [meeting]);

  const me = useMemo(() => {
    if (!user?.userId) return undefined;
    return (
      participants.find((p) => p.userId === user.userId) ??
      (meeting?.participants as unknown as MeetingParticipantRaw[])?.find(
        (p) => String(p.userId || p.user_id) === user.userId
      )
    );
  }, [participants, meeting, user]);

  const isTopAdmin = Boolean(
    user?.isSuperAdmin ||
    ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes((user?.userRole || '').toUpperCase())
  );
  const meRole = (
    (me as MeetingParticipant)?.participantRole ||
    (me as unknown as MeetingParticipantRaw)?.participant_role ||
    ''
  ).toString().toUpperCase();

  const canManage = Boolean(
    meRole === 'HOST' ||
    meRole === 'MODERATOR' ||
    (meeting?.createdBy && user?.userId && meeting.createdBy === user.userId) ||
    isTopAdmin
  );
  const isHost = Boolean(
    meRole === 'HOST' ||
    (meeting?.createdBy && user?.userId && meeting.createdBy === user.userId) ||
    isTopAdmin
  );
  const canPost = (me as MeetingParticipant)?.canUseChat ?? (me as unknown as MeetingParticipantRaw)?.can_use_chat ?? true;
  const joinUrl = meeting ? `${window.location.origin}/meetings/join/${meeting.meetingJoinCode}` : '';

  const handleShare = async () => {
    if (!joinUrl) return;
    const res = await shareOrCopy({
      title: meeting?.meetingTitle || 'IntellMeet Meeting',
      text: `Join meeting: ${meeting?.meetingTitle || 'IntellMeet'}`,
      url: joinUrl,
    });
    if (res === 'shared' || res === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const leaving = useMutation<unknown, void>({
    mutationFn: () => leaveMeeting(id),
    onSuccess: () => navigate('/meetings'),
  });

  const confirmLeave = async () => {
    setShowLeaveModal(false);
    leaving.mutate();
  };

  const isCreatorOrHost = Boolean(
    meeting?.createdBy === user?.userId ||
    canManage
  );

  const endingMeeting = useMutation<unknown, void>({
    mutationFn: async () => {
      const res = await endMeeting(id, { aiSummaryEnabled });
      getMeetingSocket().emit('meeting:end', { meetingId: id, aiSummaryEnabled });
      return res;
    },
    onSuccess: () => {
      setShowLeaveModal(false);
      navigate('/meetings');
    },
    onError: (err) => {
      showToast(parseApiError(err).message);
    },
  });

  const confirmEndMeeting = () => {
    endingMeeting.mutate();
  };

  const savePermissions = useMutation<Meeting, [string, ParticipantPermissions]>({
    mutationFn: ([participantId, permissions]) =>
      import('@/api/meeting/meeting.api').then((m) =>
        m.updateParticipantSettings(id, participantId, permissions)
      ),
    onSuccess: () => {
      setEditing(null);
      void refetch();
    },
  });

  const joined = useMemo(() => {
    const list: MeetingParticipant[] = [];

    if (user?.userId) {
      const rosterSelf = participants.find((p) => p.userId === user.userId);
      list.push({
        userId: user.userId,
        userName: user.userName || 'You',
        avatarUrl: user.avatarUrl,
        participantRole: rosterSelf?.participantRole || (meeting?.createdBy === user.userId ? 'HOST' : 'MEMBER'),
        participantStatus: 'JOINED',
        canSendAudio: micOn,
        canSendVideo: cameraOn,
        canShareScreen: rtc.isScreenSharing,
        canUseChat: true,
      });
    }

    for (const [peerId, peer] of Object.entries(rtc.peers)) {
      if (peerId && peerId !== user?.userId) {
        const rosterMatch = participants.find((p) => p.userId === peerId);
        list.push({
          userId: peerId,
          userName: rosterMatch?.userName,
          avatarUrl: rosterMatch?.avatarUrl,
          participantRole: rosterMatch?.participantRole || (meeting?.createdBy === peerId ? 'HOST' : 'MEMBER'),
          participantStatus: 'JOINED',
          canSendAudio: peer.audioEnabled,
          canSendVideo: peer.videoEnabled,
          canShareScreen: false,
          canUseChat: true,
        });
      }
    }

    return list;
  }, [user, meeting, participants, rtc.peers, rtc.isScreenSharing, micOn, cameraOn]);

  if (loading) {
    return (
      <div className="min-h-dvh space-y-4 bg-background p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-destructive">{parseApiError(error).message}</p>
        <Button variant="outline" onClick={() => navigate('/meetings')}>
          Back to meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col bg-background text-foreground overflow-hidden">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-sm bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow-xl flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <MeetingHeader
        title={meeting.meetingTitle}
        connectedCount={joined.length}
        copied={copied}
        onCopyLink={handleShare}
        onOpenParticipants={toggleParticipantsPanel}
        isParticipantsOpen={panel === 'people'}
        raisedHands={raisedHands}
        currentUserId={user?.userId}
        canManage={canManage}
        onLowerHand={handleLowerHand}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden relative">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-300 ease-in-out bg-background">
          <MeetingVideoStage
            title={meeting.meetingTitle}
            participants={joined}
            currentUserId={user?.userId}
            localStream={rtc.localStream}
            screenStream={rtc.screenStream}
            isScreenSharing={rtc.isScreenSharing}
            peers={rtc.peers}
            getParticipantDisplayName={getParticipantDisplayName}
            getParticipantAvatar={getParticipantAvatar}
            speakerMuted={!speakerOn}
            selectedSpeaker={selectedSpeaker}
            localCameraOn={cameraOn}
            localMicOn={micOn}
            onOpenParticipants={toggleParticipantsPanel}
            activeCaption={captions.activeCaption}
            captionHistory={captions.captionHistory}
            captionsEnabled={captions.captionsEnabled}
            captionFontSize={captionFontSize}
            captionOpacity={captionOpacity}
          />
        </div>

        <div
          className={cn(
            "overflow-hidden flex flex-col shrink-0 border-l z-20 bg-card shadow-xs",
            "transition-[width,max-width,opacity,transform] duration-300 ease-in-out",
            panel
              ? "w-full sm:w-80 md:w-96 max-w-full sm:max-w-80 md:max-w-96 opacity-100 translate-x-0 border-border/80"
              : "w-0 max-w-0 opacity-0 translate-x-10 pointer-events-none border-transparent"
          )}
        >
          {renderedPanel && (
            <div className="w-full sm:w-80 md:w-96 h-full min-h-0 flex flex-col shrink-0">
              <MeetingSidebar
                panel={renderedPanel}
                onSetPanel={handleSetPanel}
                onClose={() => handleSetPanel(null)}
                joined={joined}
                canManage={canManage}
                isHost={isHost}
                onEditParticipant={setEditing}
                currentUserId={user?.userId}
                currentUserName={user?.userName}
                localMicOn={micOn}
                peers={rtc.peers}
                onToggleMuteParticipant={(participant) => {
                  if (participant.userId === user?.userId) {
                    const nextMic = !micOn;
                    setMicOn(nextMic);
                    rtc.setAudioEnabled(nextMic);
                    showToast(nextMic ? 'Microphone unmuted' : 'Microphone muted');
                    return;
                  }
                  const currentAudio = participant.canSendAudio;
                  savePermissions.mutate([
                    participant.userId,
                    {
                      canSendAudio: !currentAudio,
                      canSendVideo: participant.canSendVideo,
                      canShareScreen: participant.canShareScreen,
                      canUseChat: participant.canUseChat,
                    },
                  ]);
                  showToast(`${participant.userName || 'Participant'} ${currentAudio ? 'muted' : 'unmuted'}`);
                }}
                onRemoveParticipant={(userId) => {
                  const target = participants.find((p) => p.userId === userId) || joined.find((p) => p.userId === userId);
                  savePermissions.mutate([
                    userId,
                    {
                      canSendAudio: false,
                      canSendVideo: false,
                      canShareScreen: false,
                      canUseChat: false,
                    },
                  ]);
                  showToast(`Removed ${target?.userName || 'participant'} permissions`);
                }}
                meetingId={meeting.meetingId}
                canPost={Boolean(canPost)}
                onToast={showToast}
                getParticipantDisplayName={getParticipantDisplayName}
                getParticipantEmail={getParticipantEmail}
                getParticipantMeetingRole={getParticipantMeetingRole}
                participants={meeting.participants}
                isTopAdmin={isTopAdmin}
                questions={questions}
                qaPending={qaPending}
                onAskQuestion={handleAskQuestion}
                onAnswerQuestion={handleAnswerQuestion}
                onDismissQuestion={handleDismissQuestion}
                polls={polls}
                pollPending={pollPending}
                onCreatePoll={handleCreatePoll}
                onVotePoll={handleVotePoll}
                onClosePoll={handleClosePoll}
                chatMessages={chatMessages}
                setChatMessages={setChatMessages}
                raisedHands={raisedHands}
                onLowerHand={handleLowerHand}
              />
            </div>
          )}
        </div>
      </div>

      <MeetingControls
        localStream={rtc.localStream}
        micOn={micOn}
        onToggleMic={handleToggleMic}
        audioInputs={audioInputs}
        selectedMic={selectedMic}
        onSelectMic={(deviceId) => {
          setSelectedMic(deviceId);
          void rtc.switchMicrophone(deviceId);
        }}
        speakerOn={speakerOn}
        onToggleSpeaker={handleToggleSpeaker}
        audioOutputs={audioOutputs}
        selectedSpeaker={selectedSpeaker}
        onSelectSpeaker={async (deviceId) => {
          setSelectedSpeaker(deviceId);
          try {
            const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
            const sinkId = !deviceId || deviceId === 'default' ? '' : deviceId;
            for (const el of mediaElements) {
              const audioSinkEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
              if (typeof audioSinkEl.setSinkId === 'function') {
                await audioSinkEl.setSinkId(sinkId);
              }
            }
          } catch (err) {
            console.warn('Failed to set speaker device:', err);
          }
        }}
        cameraOn={cameraOn}
        onToggleCamera={handleToggleCamera}
        videoInputs={videoInputs}
        selectedCamera={selectedCamera}
        onSelectCamera={(deviceId) => {
          setSelectedCamera(deviceId);
          void rtc.switchCamera(deviceId);
        }}
        isScreenSharing={rtc.isScreenSharing}
        onToggleScreenShare={rtc.toggleScreenShare}
        handRaised={isMyHandRaised}
        onToggleHandRaise={handleToggleHandRaise}
        captionsEnabled={captions.captionsEnabled}
        captionsSupported={captions.isSupported}
        onToggleCaptions={captions.toggleCaptions}
        captionFontSize={captionFontSize}
        onSelectCaptionFontSize={setCaptionFontSize}
        captionOpacity={captionOpacity}
        onSelectCaptionOpacity={setCaptionOpacity}
        isHost={isHost || isCreatorOrHost}
        aiSummaryEnabled={aiSummaryEnabled}
        onToggleAiSummary={() => {
          const next = !aiSummaryEnabled;
          setAiSummaryEnabled(next);
          showToast(next ? 'AI Summary enabled for this meeting' : 'AI Summary disabled for this meeting');
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onLeaveClick={() => setShowLeaveModal(true)}
        panel={panel}
        onSelectPanel={handleSetPanel}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
      />

      <MeetingLeaveModal
        open={showLeaveModal}
        isCreatorOrHost={isCreatorOrHost}
        isLeaving={leaving.pending}
        isEnding={endingMeeting.pending}
        onCancel={() => setShowLeaveModal(false)}
        onConfirmLeave={confirmLeave}
        onConfirmEndMeeting={confirmEndMeeting}
        onViewSummary={() => navigate(`/meetings/${id}/summary`)}
      />

      <MeetingEndedModal
        open={meetingEndedByHost}
        onReturnToMeetings={() => navigate('/meetings')}
        onGoToProjects={() => navigate('/projects')}
        onViewSummary={() => navigate(`/meetings/${id}/summary`)}
      />

      {editing && (
        <ParticipantSettingsModal
          key={editing.userId}
          participant={editing}
          pending={savePermissions.pending}
          onClose={() => setEditing(null)}
          onSave={async (participantId, permissions) => {
            await savePermissions.mutateAsync([participantId, permissions]);
          }}
        />
      )}
    </div>
  );
};

export default MeetingRoom;
