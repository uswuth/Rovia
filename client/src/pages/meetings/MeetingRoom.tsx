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
import { useMeetingRecorder, type SpeakerTrack } from '@/hooks/useMeetingRecorder';
import type { Meeting, MeetingParticipant, MeetingParticipantRaw, MeetingPreview } from '@/api/meeting/meeting.types';
import { normalizeParticipants } from '@/api/meeting/meeting.types';
import type { MeetingChatMessage, RaisedHand } from '@/api/meeting/webrtc.types';

import { MeetingHeader } from '@/components/meetings/MeetingHeader';
import { MeetingVideoStage } from '@/components/meetings/MeetingVideoStage';
import { MeetingControls, type PanelKey } from '@/components/meetings/MeetingControls';
import { MeetingSidebar } from '@/components/meetings/MeetingSidebar';
import { MeetingLeaveModal } from '@/components/meetings/MeetingLeaveModal';
import { MeetingEndedModal } from '@/components/meetings/MeetingEndedModal';
import { MeetingAiSummaryCard } from '@/components/meetings/MeetingAiSummaryCard';
import { ParticipantSettingsModal, type ParticipantPermissions } from '@/components/meetings/ParticipantSettingsModal';
import { shareOrCopy } from '@/lib/share';
import { cn } from '@/lib/utils';

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

  const [micOn, setMicOn] = useState(() => (location.state as { initialMic?: boolean } | null)?.initialMic ?? true);
  const [cameraOn, setCameraOn] = useState(() => (location.state as { initialCamera?: boolean } | null)?.initialCamera ?? true);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const isMyHandRaised = raisedHands.some((h) => h.userId === user?.userId);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [meetingEndedByHost, setMeetingEndedByHost] = useState(false);

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

  const getParticipantDisplayName = useCallback((participant: { userId?: string; userName?: string; name?: string } | MeetingParticipant) => {
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
  }, [orgMembers, user?.userId, user?.userName]);

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

  const recorder = useMeetingRecorder({ meetingId: id, onError: showToast });

  // Read once so the callback below depends on plain values, not the `user`
  // object: the React Compiler cannot verify `user?.userId` as a dependency.
  const currentUserId = user?.userId;
  const currentUserName = user?.userName;

  // Remote audio only exists in the peer map, so tracks are assembled at capture start rather than once.
  const handleToggleRecording = useCallback(async () => {
    if (recorder.isRecording) {
      await recorder.stopRecording();
      return;
    }

    const tracks: SpeakerTrack[] = [];

    // 1. Gather all other participants' audio tracks from WebRTC peers
    for (const [peerId, peer] of Object.entries(rtc.peers)) {
      if (peer.stream?.getAudioTracks().length) {
        tracks.push({
          speakerId: peerId,
          speakerName: getParticipantDisplayName({ userId: peerId }),
          stream: peer.stream,
        });
      }
    }

    // 2. Always acquire or refresh live microphone audio track so physical mic speech is captured
    let audioStream = rtc.localStream;
    const hasLiveMic = audioStream?.getAudioTracks().some((t) => t.readyState === 'live');
    if (!hasLiveMic) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        // Fallback silently if user denied or hardware missing
      }
    }

    if (audioStream?.getAudioTracks().length) {
      tracks.push({
        speakerId: currentUserId ?? 'me',
        speakerName: currentUserName || 'You',
        stream: audioStream,
      });
    } else {
      // Try acquiring microphone stream
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (audioStream?.getAudioTracks().length) {
          tracks.push({
            speakerId: currentUserId ?? 'me',
            speakerName: currentUserName || 'You',
            stream: audioStream,
          });
        }
      } catch {
        // If mic is denied or unavailable, create an AudioContext silent track so recording can proceed
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001; // active minimal non-zero signal
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          tracks.push({
            speakerId: currentUserId ?? 'me',
            speakerName: currentUserName || 'You',
            stream: dst.stream,
          });
        } catch {
          // Ignore
        }
      }
    }

    if (tracks.length === 0) {
      showToast('Could not initialize audio capture.');
      return;
    }

    await recorder.startRecording(tracks);
  }, [recorder, rtc.localStream, rtc.peers, currentUserId, currentUserName, getParticipantDisplayName, showToast]);

  // One-second tick, not per-frame: the display shows whole seconds only.
  const [recordingTick, setRecordingTick] = useState(0);
  useEffect(() => {
    if (!recorder.isRecording) return undefined;
    const timer = window.setInterval(() => setRecordingTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recorder.isRecording]);
  const recordingElapsedMs = recorder.isRecording ? recordingTick * 1000 : 0;

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

  const questions = useQuery<MeetingQuestion[]>(
    queryKeys.meetings.questions(id),
    () => getMeetingQuestions(id),
    { enabled: Boolean(id) && panel === 'qa', list: true, refetchInterval: panel === 'qa' ? 3000 : false }
  );

  const polls = useQuery<MeetingPoll[]>(
    queryKeys.meetings.polls(id),
    () => getMeetingPolls(id),
    { enabled: Boolean(id), list: true }
  );

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    const s = getMeetingSocket();

    const handleEnded = () => {
      setMeetingEndedByHost(true);
    };
    const handlePollUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.polls(id) });
    };
    const handleQuestionUpdated = () => {
      void questions.refetch();
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.questions(id) });
    };
    const handleParticipantUpdated = (data: { meetingId: string; participantId: string; permissions?: Record<string, boolean> }) => {
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
      }
    };
    const handleMessage = (message: MeetingChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.messageId === message.messageId)) return prev;
        return [...prev, message];
      });
    };
    const handleHandsUpdated = (data: { hands: RaisedHand[] }) => {
      setRaisedHands(data?.hands || []);
    };

    s.on('meeting:ended', handleEnded);
    s.on('meeting:poll-updated', handlePollUpdated);
    s.on('meeting:question-updated', handleQuestionUpdated);
    s.on('meeting:participant-updated', handleParticipantUpdated);
    s.on('meeting:message', handleMessage);
    s.on('meeting:hands-updated', handleHandsUpdated);

    return () => {
      s.off('meeting:ended', handleEnded);
      s.off('meeting:poll-updated', handlePollUpdated);
      s.off('meeting:question-updated', handleQuestionUpdated);
      s.off('meeting:participant-updated', handleParticipantUpdated);
      s.off('meeting:message', handleMessage);
      s.off('meeting:hands-updated', handleHandsUpdated);
    };
  }, [id, isAuthenticated, queryClient, questions, refetch, rtc, showToast, user?.userId]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const isKeyC = event.code === 'KeyC' || event.key.toLowerCase() === 'c';
        const isKeyV = event.code === 'KeyV' || event.key.toLowerCase() === 'v';
        const isKeyB = event.code === 'KeyB' || event.key.toLowerCase() === 'b';
        const isKeyN = event.code === 'KeyN' || event.key.toLowerCase() === 'n';

        if (isKeyC) {
          event.preventDefault();
          handleToggleMic();
        } else if (isKeyV) {
          event.preventDefault();
          handleToggleCamera();
        } else if (isKeyB) {
          event.preventDefault();
          handleToggleSpeaker();
        } else if (isKeyN) {
          event.preventDefault();
          handleMuteAllThree();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMic, handleToggleCamera, handleToggleSpeaker, handleMuteAllThree]);

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
    if (recorder.isRecording) {
      await recorder.stopRecording();
    }
    leaving.mutate();
  };

  const isCreatorOrHost = Boolean(
    meeting?.createdBy === user?.userId ||
    canManage
  );

  const endingMeeting = useMutation<unknown, void>({
    mutationFn: async () => {
      if (recorder.isRecording) {
        await recorder.stopRecording();
      }
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

      <div className="flex min-h-0 flex-1 flex-row overflow-hidden relative">
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
          />
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out flex flex-col shrink-0 border-l z-20 bg-card shadow-xs",
            panel
              ? "w-80 md:w-96 opacity-100 translate-x-0 border-border/80"
              : "w-0 opacity-0 translate-x-10 pointer-events-none border-transparent"
          )}
        >
          {renderedPanel && (
            <div className="w-80 md:w-96 h-full min-h-0 flex flex-col shrink-0">
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
        isRecording={recorder.isRecording}
        onToggleRecording={handleToggleRecording}
        recordingStage={recorder.stage}
        recordingElapsedMs={recordingElapsedMs}
        showRecordModal={showRecordModal}
        setShowRecordModal={setShowRecordModal}
        aiSummaryEnabled={aiSummaryEnabled}
        setAiSummaryEnabled={setAiSummaryEnabled}
        canManage={canManage}
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
      />

      <MeetingEndedModal
        open={meetingEndedByHost}
        onReturnToMeetings={() => navigate('/meetings')}
        onGoToProjects={() => navigate('/projects')}
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

      {(recorder.stage !== 'idle' || recorder.summary || recorder.transcript || (recorder.rawAudioUrls && recorder.rawAudioUrls.length > 0)) && (
        <MeetingAiSummaryCard
          stage={recorder.stage}
          error={recorder.error}
          summary={recorder.summary}
          transcript={recorder.transcript}
          rawAudioUrls={recorder.rawAudioUrls}
        />
      )}
    </div>
  );
};

export default MeetingRoom;
