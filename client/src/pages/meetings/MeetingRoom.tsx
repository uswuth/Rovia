import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery, useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getMemberId } from '@/components/members/member-utils';
import { parseApiError } from '@/utils/apiError';
import {
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  endMeeting,
  previewMeetingByJoinCode,
} from '@/api/meeting/meeting.api';
import { getMeetingSocket } from '@/api/meeting/meeting-socket';
import {
  getMeetingQuestions,
  askQuestion,
  answerQuestion,
  dismissQuestion,
  type MeetingQuestion,
} from '@/api/meeting/meeting-qa.api';
import {
  getMeetingPolls,
  createPoll,
  votePoll,
  closePoll,
  type MeetingPoll,
} from '@/api/meeting/meeting-poll.api';
import { useWebRtcMeeting } from '@/hooks/useWebRtcMeeting';
import type { Meeting, MeetingParticipant, MeetingParticipantRaw, MeetingPreview } from '@/api/meeting/meeting.types';
import { normalizeParticipants } from '@/api/meeting/meeting.types';

// Modular Meeting Subcomponents
import { MeetingHeader } from '@/components/meetings/MeetingHeader';
import { MeetingVideoStage, type LayoutViewMode } from '@/components/meetings/MeetingVideoStage';
import { MeetingControls, type PanelKey } from '@/components/meetings/MeetingControls';
import { MeetingSidebar } from '@/components/meetings/MeetingSidebar';
import { MeetingLeaveModal } from '@/components/meetings/MeetingLeaveModal';
import { MeetingEndedModal } from '@/components/meetings/MeetingEndedModal';
import { ParticipantSettingsModal, type ParticipantPermissions } from '@/components/meetings/ParticipantSettingsModal';
import { shareOrCopy } from '@/lib/share';
import { cn } from '@/lib/utils';

export const MeetingRoom: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Active view states
  const [panel, setPanel] = useState<PanelKey | null>('people');
  const [renderedPanel, setRenderedPanel] = useState<PanelKey | null>('people');

  const handleSetPanel = useCallback((p: PanelKey | null) => {
    setPanel(p);
    if (p) {
      setRenderedPanel(p);
    }
  }, []);
  const [layoutMode, setLayoutMode] = useState<LayoutViewMode>('grid');
  const [editing, setEditing] = useState<MeetingParticipant | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-call toggles
  const [micOn, setMicOn] = useState(() => (location.state as { initialMic?: boolean } | null)?.initialMic ?? true);
  const [cameraOn, setCameraOn] = useState(() => (location.state as { initialCamera?: boolean } | null)?.initialCamera ?? true);
  const [handRaised, setHandRaised] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dialog & popover states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [meetingEndedByHost, setMeetingEndedByHost] = useState(false);

  // Recording & AI Summary
  const [isRecording, setIsRecording] = useState(false);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);

  const locationState = location.state as {
    fromLobby?: boolean;
    initialCamera?: boolean;
    initialMic?: boolean;
    selectedMic?: string;
    selectedCamera?: string;
    selectedSpeaker?: string;
    preview?: MeetingPreview;
  } | null;

  // Device selectors
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>(() => locationState?.selectedMic || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(() => locationState?.selectedSpeaker || '');
  const [selectedCamera, setSelectedCamera] = useState<string>(() => locationState?.selectedCamera || '');
  const [speakerOn, setSpeakerOn] = useState<boolean>(true);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const { members: orgMembers } = useOrganization();

  const getParticipantDisplayName = (participant: { userId?: string; userName?: string; name?: string } | MeetingParticipant) => {
    const pId = participant.userId || '';
    if (pId === user?.userId) return user?.userName || 'You';

    const matchedMember = (orgMembers || []).find((m) => {
      const mId = getMemberId(m);
      return mId === pId || (m as unknown as Record<string, string>).id === pId || (m as unknown as Record<string, string>)._id === pId;
    });

    if (matchedMember) {
      const mRaw = matchedMember as unknown as Record<string, string>;
      return mRaw.name || matchedMember.userName || mRaw.email || matchedMember.userEmail || 'Member';
    }

    const raw = participant as unknown as Record<string, string>;
    if (raw.userName || raw.name) {
      return raw.userName || raw.name;
    }

    return pId.length > 20 ? `Participant (${pId.slice(-4)})` : pId;
  };

  const getParticipantAvatar = (participant: { userId?: string } | MeetingParticipant): string | undefined => {
    const pId = participant.userId || '';
    if (pId === user?.userId) return user?.avatarUrl;

    const raw = participant as unknown as Record<string, string>;
    if (raw.avatarUrl || raw.avatar) return raw.avatarUrl || raw.avatar;

    const matchedMember = (orgMembers || []).find((m) => {
      const mId = getMemberId(m);
      return mId === pId || (m as unknown as Record<string, string>).id === pId || (m as unknown as Record<string, string>)._id === pId;
    });

    if (matchedMember) {
      const mRaw = matchedMember as unknown as Record<string, string>;
      return mRaw.avatarUrl || mRaw.avatar;
    }

    return undefined;
  };

  const getParticipantEmail = (participant: { userId?: string }): string | undefined => {
    const pId = participant.userId || '';
    if (pId === user?.userId) return user?.userEmail || (user as unknown as Record<string, string>)?.email;

    const matchedMember = (orgMembers || []).find((m) => {
      const mId = getMemberId(m);
      return mId === pId || (m as unknown as Record<string, string>).id === pId || (m as unknown as Record<string, string>)._id === pId;
    });

    if (matchedMember) {
      const mRaw = matchedMember as unknown as Record<string, string>;
      return mRaw.email || mRaw.userEmail || (matchedMember as unknown as Record<string, string>).email;
    }

    const meetingPart = meeting?.participants?.find((mp) => mp.userId === pId || (mp as unknown as MeetingParticipantRaw).user_id === pId);
    if (meetingPart) {
      const mpRaw = meetingPart as unknown as MeetingParticipantRaw & { email?: string; userEmail?: string; user?: { email?: string; userEmail?: string } };
      return (
        mpRaw.userEmail ||
        mpRaw.email ||
        mpRaw.user?.email ||
        mpRaw.user?.userEmail
      );
    }

    return undefined;
  };

  const getParticipantMeetingRole = (participant: { userId?: string }): 'Host' | 'Moderator' | 'Member' => {
    const pId = participant.userId || '';
    const isCreator = meeting?.createdBy && meeting.createdBy === pId;
    const meetingPart = meeting?.participants?.find((mp) => mp.userId === pId || (mp as unknown as MeetingParticipantRaw).user_id === pId);
    const role = (meetingPart?.participantRole || (meetingPart as unknown as MeetingParticipantRaw)?.participant_role || '').toString().toUpperCase();

    if (isCreator || role === 'HOST') return 'Host';
    if (role === 'MODERATOR') return 'Moderator';
    return 'Member';
  };

  // Query meeting details
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

  // Mark participant as JOINED upon entering room
  useEffect(() => {
    if (id && isAuthenticated) {
      joinMeeting(id).then(() => {
        void refetch();
      }).catch(() => {});
    }
  }, [id, isAuthenticated, refetch]);

  // WebRTC meeting hook
  const rtc = useWebRtcMeeting(id, Boolean(id) && isAuthenticated, {
    initialAudioDeviceId: locationState?.selectedMic,
    initialVideoDeviceId: locationState?.selectedCamera,
    onPeerJoined: () => {
      void refetch();
    },
    onPeerLeft: (leftUserId) => {
      const leftName = getParticipantDisplayName({ userId: leftUserId });
      showToast(`${leftName} left`);
      void refetch();
    },
  });

  // Clean socket room leave on tab/window unload
  useEffect(() => {
    const handleUnload = () => {
      if (id) {
        import('@/api/meeting/meeting-socket').then((m) => {
          m.getMeetingSocket().emit('meeting:leave', id);
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [id]);

  // Panel queries (Q&A and Polls)
  const questions = useQuery<MeetingQuestion[]>(
    queryKeys.meetings.questions(id),
    () => getMeetingQuestions(id),
    { enabled: Boolean(id) && panel === 'qa', list: true }
  );

  const polls = useQuery<MeetingPoll[]>(
    queryKeys.meetings.polls(id),
    () => getMeetingPolls(id),
    { enabled: Boolean(id), list: true }
  );

  // Listen for meeting:ended, meeting:poll-updated, and meeting:participant-updated broadcast from socket
  useEffect(() => {
    if (!id || !isAuthenticated) return;
    let s: ReturnType<typeof import('@/api/meeting/meeting-socket').getMeetingSocket> | null = null;
    import('@/api/meeting/meeting-socket').then((m) => {
      s = m.getMeetingSocket();
      s.on('meeting:ended', () => {
        setMeetingEndedByHost(true);
      });
      s.on('meeting:poll-updated', () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.polls(id) });
      });
      s.on('meeting:participant-updated', (data: { meetingId: string; participantId: string; permissions?: Record<string, boolean> }) => {
        void refetch();
        if (data.participantId === user?.userId) {
          if (data.permissions?.canSendAudio === false) {
            setMicOn(false);
            rtc.setAudioEnabled(false);
            showToast('You were muted by the host');
          }
          if (data.permissions?.canSendVideo === false) {
            setCameraOn(false);
            rtc.setVideoEnabled(false);
            showToast('Your camera was turned off by the host');
          }
          if (data.permissions?.canShareScreen === false && rtc.screenStream) {
            rtc.stopScreenShare();
            showToast('Your screen sharing was ended by the host');
          }
        }
      });
    }).catch(() => {});

    return () => {
      if (s) {
        s.off('meeting:ended');
        s.off('meeting:poll-updated');
        s.off('meeting:participant-updated');
      }
    };
  }, [id, isAuthenticated, queryClient, refetch, rtc, showToast, user?.userId]);

  // Track Fullscreen state changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Enumerate media devices and synchronize with lobby selections
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        const videos = devices.filter((d) => d.kind === 'videoinput');

        setAudioInputs(audios);
        setAudioOutputs(outputs);
        setVideoInputs(videos);

        setSelectedMic((prev) => {
          if (prev && audios.some((d) => d.deviceId === prev)) return prev;
          if (locationState?.selectedMic && audios.some((d) => d.deviceId === locationState.selectedMic)) {
            return locationState.selectedMic;
          }
          return audios[0]?.deviceId || 'default';
        });

        setSelectedCamera((prev) => {
          if (prev && videos.some((d) => d.deviceId === prev)) return prev;
          if (locationState?.selectedCamera && videos.some((d) => d.deviceId === locationState.selectedCamera)) {
            return locationState.selectedCamera;
          }
          return videos[0]?.deviceId || 'default';
        });

        setSelectedSpeaker((prev) => {
          if (prev && outputs.some((d) => d.deviceId === prev)) return prev;
          if (locationState?.selectedSpeaker && outputs.some((d) => d.deviceId === locationState.selectedSpeaker)) {
            return locationState.selectedSpeaker;
          }
          return outputs[0]?.deviceId || 'default';
        });
      } catch {
        // Fallback silently if permission prompt pending
      }
    };
    void fetchDevices();
    navigator.mediaDevices?.addEventListener('devicechange', fetchDevices);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', fetchDevices);
  }, [locationState?.selectedMic, locationState?.selectedCamera, locationState?.selectedSpeaker, rtc.localStream]);

  const [qaPending, setQaPending] = useState(false);
  const [pollPending, setPollPending] = useState(false);

  const handleAskQuestion = async (questionText: string) => {
    setQaPending(true);
    try {
      await askQuestion(id, questionText);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  };

  const handleAnswerQuestion = async (questionId: string, answerText: string) => {
    setQaPending(true);
    try {
      await answerQuestion(id, questionId, answerText);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  };

  const handleDismissQuestion = async (questionId: string) => {
    setQaPending(true);
    try {
      await dismissQuestion(id, questionId);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  };

  const handleCreatePoll = async (pollQuestion: string, options: string[]) => {
    setPollPending(true);
    try {
      await createPoll(id, { pollQuestion, options, multipleChoice: false });
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  };

  const handleVotePoll = async (pollId: string, optionIds: string[]) => {
    setPollPending(true);
    try {
      await votePoll(id, pollId, optionIds);
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    setPollPending(true);
    try {
      await closePoll(id, pollId);
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  };

  const me = meeting?.participants.find((p) => p.userId === user?.userId);
  const isTopAdmin = Boolean(
    user?.isSuperAdmin ||
    ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes((user?.userRole || '').toUpperCase())
  );
  const canManage = Boolean(
    me?.participantRole === 'HOST' ||
    me?.participantRole === 'MODERATOR' ||
    meeting?.createdBy === user?.userId ||
    isTopAdmin
  );
  const isHost = Boolean(
    me?.participantRole === 'HOST' ||
    meeting?.createdBy === user?.userId ||
    isTopAdmin
  );
  const canPost = me?.canUseChat ?? true;
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

  const confirmLeave = () => {
    setShowLeaveModal(false);
    leaving.mutate();
  };

  const isCreatorOrHost = Boolean(
    meeting?.createdBy === user?.userId ||
    canManage
  );

  const endingMeeting = useMutation<unknown, void>({
    mutationFn: async () => {
      const res = await endMeeting(id);
      getMeetingSocket().emit('meeting:end', id);
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

  const participants = useMemo(() => {
    return normalizeParticipants((meeting?.participants ?? []) as unknown as MeetingParticipantRaw[]);
  }, [meeting]);

  const joined = useMemo(() => {
    const list: MeetingParticipant[] = [];

    // Current user (yourself) is actively live in the room
    if (user?.userId) {
      const rosterSelf = participants.find((p) => p.userId === user.userId);
      list.push({
        userId: user.userId,
        userName: user.userName || 'You',
        avatarUrl: user.avatarUrl,
        participantRole: rosterSelf?.participantRole || (meeting?.createdBy === user.userId ? 'HOST' : 'MEMBER'),
        participantStatus: 'JOINED',
        canSendAudio: true,
        canSendVideo: true,
        canShareScreen: true,
        canUseChat: true,
      });
    }

    // Only active dynamic peers currently connected in WebRTC / socket room
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
          canShareScreen: peer.screenSharing,
          canUseChat: true,
        });
      }
    }

    return list;
  }, [user, meeting, participants, rtc.peers]);

  if (loading) {
    return (
      <div className="min-h-screen space-y-4 bg-background p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-destructive">{parseApiError(error).message}</p>
        <Button variant="outline" onClick={() => navigate('/meetings')}>
          Back to meetings
        </Button>
      </div>
    );
  }

  const activeScreenSharePeer = Object.values(rtc.peers).find((p) => p.screenSharing && p.stream);

  return (
    <div className="flex h-screen max-h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow-xl flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <MeetingHeader
        title={meeting.meetingTitle}
        connectedCount={joined.length}
        copied={copied}
        onCopyLink={handleShare}
      />

      {/* Main Content: Video Stage on the Left, Collapsible Sidebar on the Right */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden relative">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-300 ease-in-out">
          <MeetingVideoStage
            screenStream={rtc.screenStream}
            activeScreenSharePeer={activeScreenSharePeer}
            onStopScreenShare={rtc.stopScreenShare}
            participants={joined}
            currentUserId={user?.userId}
            handRaised={handRaised}
            localStream={rtc.localStream}
            peers={rtc.peers}
            layoutMode={layoutMode}
            getParticipantDisplayName={getParticipantDisplayName}
            getParticipantAvatar={getParticipantAvatar}
            speakerMuted={!speakerOn}
            selectedSpeaker={selectedSpeaker}
            localCameraOn={cameraOn}
            localMicOn={micOn}
          />
        </div>

        {/* Collapsible Aside Panel with dynamic scale & slide from/to right */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out flex flex-col shrink-0 origin-right border-border",
            panel
              ? "w-full lg:w-96 opacity-100 scale-100 translate-x-0 border-t lg:border-t-0 lg:border-l"
              : "w-0 lg:w-0 max-h-0 lg:max-h-none opacity-0 scale-95 translate-x-12 pointer-events-none border-0"
          )}
        >
          {renderedPanel && (
            <div className="w-full lg:w-96 h-full min-h-0 flex flex-col shrink-0">
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
                activeScreenShareUserId={activeScreenSharePeer?.userId}
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
                onEndParticipantScreenShare={(userId) => {
                  const target = participants.find((p) => p.userId === userId) || joined.find((p) => p.userId === userId);
                  savePermissions.mutate([
                    userId,
                    {
                      canSendAudio: target?.canSendAudio ?? true,
                      canSendVideo: target?.canSendVideo ?? true,
                      canShareScreen: false,
                      canUseChat: target?.canUseChat ?? true,
                    },
                  ]);
                  showToast(`Ended screen share for ${target?.userName || 'participant'}`);
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
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Toolbar Dock */}
      <MeetingControls
        localStream={rtc.localStream}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording(!isRecording)}
        showRecordModal={showRecordModal}
        setShowRecordModal={setShowRecordModal}
        aiSummaryEnabled={aiSummaryEnabled}
        setAiSummaryEnabled={setAiSummaryEnabled}
        canManage={canManage}
        micOn={micOn}
        onToggleMic={() => {
          setMicOn((on) => {
            const next = !on;
            rtc.setAudioEnabled(next);
            return next;
          });
        }}
        audioInputs={audioInputs}
        selectedMic={selectedMic}
        onSelectMic={(deviceId) => {
          setSelectedMic(deviceId);
          void rtc.switchMicrophone(deviceId);
        }}
        speakerOn={speakerOn}
        onToggleSpeaker={() => {
          setSpeakerOn((on) => {
            const next = !on;
            const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio'));
            for (const el of mediaElements) {
              if (el.dataset.isLocal !== 'true') {
                el.muted = !next;
              }
            }
            return next;
          });
        }}
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
        onToggleCamera={() => {
          setCameraOn((on) => {
            const next = !on;
            rtc.setVideoEnabled(next);
            return next;
          });
        }}
        videoInputs={videoInputs}
        selectedCamera={selectedCamera}
        onSelectCamera={(deviceId) => {
          setSelectedCamera(deviceId);
          void rtc.switchCamera(deviceId);
        }}
        isScreenSharing={rtc.isScreenSharing}
        onToggleScreenShare={async () => {
          if (rtc.isScreenSharing) {
            rtc.stopScreenShare();
            return;
          }
          if (activeScreenSharePeer) {
            const presenterName = getParticipantDisplayName({ userId: activeScreenSharePeer.userId });
            showToast(`${presenterName} is already sharing screen. Ask them to stop.`);
            return;
          }
          if (me && !me.canShareScreen && !canManage) {
            showToast('Only host can share screen');
            return;
          }
          await rtc.startScreenShare();
        }}
        handRaised={handRaised}
        onToggleHandRaise={() => setHandRaised(!handRaised)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onLeaveClick={() => setShowLeaveModal(true)}
        panel={panel}
        onSelectPanel={handleSetPanel}
        layoutMode={layoutMode}
        onSelectLayoutMode={setLayoutMode}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
      />

      {/* Leave or End Call Dialog */}
      <MeetingLeaveModal
        open={showLeaveModal}
        isCreatorOrHost={isCreatorOrHost}
        isLeaving={leaving.pending}
        isEnding={endingMeeting.pending}
        onCancel={() => setShowLeaveModal(false)}
        onConfirmLeave={confirmLeave}
        onConfirmEndMeeting={confirmEndMeeting}
      />

      {/* Meeting Ended for Everyone Dialog */}
      <MeetingEndedModal
        open={meetingEndedByHost}
        onReturnToMeetings={() => navigate('/meetings')}
        onGoToProjects={() => navigate('/projects')}
      />

      {/* Participant Permissions Modal */}
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
