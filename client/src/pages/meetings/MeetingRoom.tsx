import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Users, Copy, Check, Mic, MicOff, Video, VideoOff, MonitorUp,
  PhoneOff, MessageSquare, MessageCircleQuestion, BarChart3, Hand, Settings,
  ChevronUp, AlertCircle, Radio, Sparkles, Maximize2, Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery, useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getMemberId } from '@/components/members/member-utils';
import { parseApiError } from '@/utils/apiError';
import { getMeetingById, leaveMeeting, previewMeetingByJoinCode } from '@/api/meeting/meeting.api';
import { MeetingParticipants } from '@/components/meetings/MeetingParticipants';
import { ParticipantSettingsModal, type ParticipantPermissions } from '@/components/meetings/ParticipantSettingsModal';
import { MeetingQuestions } from '@/components/meetings/MeetingQuestions';
import { MeetingChat } from '@/components/meetings/MeetingChat';
import { MeetingPolls } from '@/components/meetings/MeetingPolls';
import type { Meeting, MeetingParticipant, MeetingParticipantRaw } from '@/api/meeting/meeting.types';
import { normalizeParticipants } from '@/api/meeting/meeting.types';
import { askQuestion, answerQuestion, dismissQuestion, type MeetingQuestion } from '@/api/meeting/meeting-qa.api';
import { createPoll, votePoll, closePoll, type MeetingPoll } from '@/api/meeting/meeting-poll.api';
import { useWebRtcMeeting } from '@/hooks/useWebRtcMeeting';

/** One video tile. Hand raised indicator appears when hand is raised. */
const VideoTile = ({
  name, isYou, host, muted, cameraOn, stream, handRaised, avatarUrl,
}: {
  name: string; isYou: boolean; host: boolean; isVisitor?: boolean; muted: boolean; cameraOn: boolean; stream?: MediaStream | null; handRaised?: boolean; avatarUrl?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-lg">
      {/* ALWAYS render video element so audio track plays even when camera is off */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isYou}
        className={cameraOn && stream ? "size-full object-cover -scale-x-100" : "hidden"}
      />

      {(!cameraOn || !stream) && (
        <div className="flex size-full flex-col items-center justify-center gap-3 bg-slate-900/90 p-4 text-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="size-20 rounded-full object-cover border-2 border-emerald-500/50 shadow-xl"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-2xl font-bold text-white shadow-xl border-2 border-emerald-500/30">
              {name.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <p className="text-xs font-medium text-slate-400">Camera is off</p>
        </div>
      )}

      {/* Name and status tags */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
        <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
          {name}{isYou ? ' (You)' : ''}
        </span>
        {host && (
          <span className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
            Host
          </span>
        )}
      </div>

      {/* Top right active mic/speaker status icon */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        {handRaised && (
          <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-md animate-bounce" title="Hand Raised">
            <Hand size={14} />
          </span>
        )}
        <span className="flex size-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-xs text-white">
          {muted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-emerald-400" />}
        </span>
      </div>
    </div>
  );
};

const PANELS = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'qa', label: 'Q&A', icon: MessageCircleQuestion },
  { key: 'polls', label: 'Polls', icon: BarChart3 },
] as const;

type PanelKey = (typeof PANELS)[number]['key'];
type LayoutViewMode = 'grid' | 'focus' | 'compact';

export const MeetingRoom: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const [panel, setPanel] = useState<PanelKey>('people');
  const [editing, setEditing] = useState<MeetingParticipant | null>(null);
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(() => (location.state as { initialMic?: boolean } | null)?.initialMic ?? true);
  const [cameraOn, setCameraOn] = useState(() => (location.state as { initialCamera?: boolean } | null)?.initialCamera ?? true);
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<LayoutViewMode>('grid');

  // Recording & AI Summary
  const [isRecording, setIsRecording] = useState(false);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);

  // Device selectors
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const { members: orgMembers } = useOrganization();

  const getParticipantDisplayName = (participant: { userId: string } | MeetingParticipant) => {
    const pId = participant.userId;
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

  const getParticipantAvatar = (participant: { userId: string } | MeetingParticipant): string | undefined => {
    const pId = participant.userId;
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

  const rtc = useWebRtcMeeting(id, Boolean(id) && isAuthenticated, {
    onPeerLeft: (leftUserId) => {
      const leftName = getParticipantDisplayName({ userId: leftUserId });
      showToast(`${leftName} left`);
    },
  });

  // Track window/tab close unload event to cleanly leave meeting socket room
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
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  // Enumerate devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
      } catch {
        // Fallback
      }
    };
    void fetchDevices();
  }, []);

  const { data: meeting, loading, error } = useQuery<Meeting>(
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
          participants: data.participants || []
        };
        return { data: { data: meetingObj } };
      }
      throw new Error('Meeting join code not found');
    },
    { enabled: Boolean(id) && isAuthenticated }
  );

  const questions = useQuery<MeetingQuestion[]>(
    queryKeys.meetings.questions(id),
    async () => {
      const { getMeetingQuestions } = await import('@/api/meeting/meeting-qa.api');
      return getMeetingQuestions(id);
    },
    { enabled: Boolean(id) && panel === 'qa', list: true }
  );

  const polls = useQuery<MeetingPoll[]>(
    queryKeys.meetings.polls(id),
    async () => {
      const { getMeetingPolls } = await import('@/api/meeting/meeting-poll.api');
      return getMeetingPolls(id);
    },
    { enabled: Boolean(id) && panel === 'polls', list: true }
  );

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

  const handleCreatePoll = async (pollQuestion: string, options: string[], multipleChoice: boolean) => {
    setPollPending(true);
    try {
      await createPoll(id, { pollQuestion, options, multipleChoice });
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
  const canManage = me?.participantRole === 'HOST' || me?.participantRole === 'MODERATOR' || meeting?.createdBy === user?.userId || isTopAdmin;
  const canPost = me?.canUseChat ?? true;
  const joinUrl = meeting ? `${window.location.origin}/meetings/join/${meeting.meetingJoinCode}` : '';

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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

  const savePermissions = useMutation<Meeting, [string, ParticipantPermissions]>({
    mutationFn: ([participantId, permissions]) =>
      import('@/api/meeting/meeting.api').then((m) =>
        m.updateParticipantSettings(id, participantId, permissions)
      ),
    onSuccess: () => setEditing(null),
  });

  const participants = useMemo(() => {
    return normalizeParticipants(meeting?.participants ?? [] as unknown as MeetingParticipantRaw[]);
  }, [meeting?.participants]);

  const activePeerUserIds = useMemo(() => {
    return new Set([
      user?.userId || '',
      ...Object.keys(rtc.peers),
    ]);
  }, [user?.userId, rtc.peers]);

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

  const joined = (participants || []).filter(
    (p) => p.participantStatus !== 'LEFT' && (activePeerUserIds.has(p.userId) || p.userId === user?.userId || p.participantStatus === 'JOINED')
  );

  const activeScreenSharePeer = Object.values(rtc.peers).find((p) => p.screenSharing && p.stream);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow-xl flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar - Clean Title & Active Connected Count (No Hard Limit) */}
      <header className="flex items-center justify-between border-b border-border px-6 h-14 bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate text-base font-bold text-foreground">{meeting.meetingTitle}</h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <Users size={15} className="text-emerald-500" />
            <span>{joined.length}</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-emerald-500" />
            Connected
          </span>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 text-xs h-8">
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 bg-muted/20 overflow-y-auto">
          {/* Active Screen Share Stage (Host or Participant) */}
          {(rtc.screenStream || activeScreenSharePeer) && (
            <div className="w-full max-w-4xl space-y-2 mb-2">
              <div className="flex items-center justify-between bg-slate-900 border border-emerald-500/40 rounded-t-xl px-4 py-2 text-xs text-white">
                <span className="flex items-center gap-2 font-bold text-emerald-400">
                  <MonitorUp size={15} />
                  {rtc.screenStream
                    ? 'You are sharing your screen'
                    : `${getParticipantDisplayName({ userId: activeScreenSharePeer?.userId || '' })} is sharing screen`}
                </span>
                {rtc.screenStream && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={rtc.stopScreenShare}
                    className="h-7 text-xs px-2.5 cursor-pointer"
                  >
                    Stop Sharing
                  </Button>
                )}
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-b-xl border border-slate-800 bg-black shadow-2xl">
                <video
                  ref={(el) => {
                    if (el) {
                      el.srcObject = rtc.screenStream || activeScreenSharePeer?.stream || null;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={Boolean(rtc.screenStream)}
                  className="size-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Participant Video Tiles Grid */}
          <div className={`grid w-full max-w-4xl gap-4 ${layoutMode === 'focus'
            ? 'grid-cols-1'
            : layoutMode === 'compact'
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2'
            }`}>
            {joined.map((participant) => (
              <VideoTile
                key={participant.userId}
                name={getParticipantDisplayName(participant)}
                avatarUrl={getParticipantAvatar(participant)}
                isYou={participant.userId === user?.userId}
                host={participant.participantRole === 'HOST'}
                muted={!participant.canSendAudio}
                cameraOn={participant.canSendVideo}
                handRaised={participant.userId === user?.userId ? handRaised : false}
                stream={participant.userId === user?.userId ? rtc.localStream : rtc.peers[participant.userId]?.stream}
              />
            ))}
          </div>
        </main>

        {/* Right Sidebar Panels */}
        <aside className="w-full shrink-0 border-t border-border p-4 lg:w-96 lg:border-l lg:border-t-0 bg-card">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            {PANELS.find((p) => p.key === panel)?.label}
          </h2>

          {panel === 'people' && (
            <MeetingParticipants
              participants={joined}
              canManage={Boolean(canManage)}
              onEditSettings={setEditing}
              currentUserId={user?.userId}
              currentUserName={user?.userName}
            />
          )}

          {panel === 'chat' && (
            <MeetingChat
              meetingId={meeting.meetingId}
              currentUserId={user?.userId ?? ''}
              canPost={Boolean(canPost)}
              onError={showToast}
              displayNameFor={(userId) => getParticipantDisplayName({ userId })}
            />
          )}

          {panel === 'qa' && (
            <MeetingQuestions
              meetingId={meeting.meetingId}
              questions={questions.data}
              loading={questions.loading}
              error={questions.error}
              canPost={canPost}
              posting={qaPending}
              onAsk={handleAskQuestion}
              onAnswer={handleAnswerQuestion}
              onDismiss={handleDismissQuestion}
            />
          )}

          {panel === 'polls' && (
            <MeetingPolls
              polls={polls.data}
              loading={polls.loading}
              error={polls.error}
              canManage={Boolean(canManage)}
              pending={pollPending}
              onCreate={handleCreatePoll}
              onVote={handleVotePoll}
              onClose={handleClosePoll}
            />
          )}
        </aside>
      </div>

      {/* Bottom Dock Bar */}
      <footer className="flex items-center justify-between border-t border-border px-6 h-16 bg-background">
        {/* Left: Record Button with Popover */}
        <div className="flex items-center gap-3">
          <Popover open={showRecordModal} onOpenChange={setShowRecordModal}>
            <PopoverTrigger
              render={
                <Button
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="sm"
                  className="gap-1.5 font-bold text-xs h-9"
                >
                  <Radio size={14} className={isRecording ? 'animate-pulse' : ''} />
                  <span>{isRecording ? 'Recording' : 'Record'}</span>
                </Button>
              }
            />
            <PopoverContent side="top" sideOffset={12} className="w-72 p-4 space-y-4 border-border bg-card shadow-xl" align="start">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Radio size={16} className="text-red-500" />
                  <span>Session Recording</span>
                </h4>
                <p className="text-xs text-muted-foreground">Manual recording session control.</p>
              </div>

              <Button
                variant={isRecording ? 'destructive' : 'default'}
                className="w-full text-xs font-bold"
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Sparkles size={13} className="text-emerald-500" />
                    AI Summary
                  </span>
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={aiSummaryEnabled}
                    onChange={(e) => setAiSummaryEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  />
                </div>
                {!canManage && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Only Host or Admin can toggle AI Summary.
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Center: Grouped Mic & Camera controls, Screen Share, Hand Raise, Leave button */}
        <div className="flex items-center gap-3">
          {/* Mic Split Button Group with Device Selector Chevron */}
          <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setMicOn((on: boolean) => {
                  const next = !on;
                  rtc.setAudioEnabled(next);
                  return next;
                });
              }}
              className={`flex size-9 items-center justify-center rounded-full transition-colors cursor-pointer ${micOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              title={micOn ? 'Mute Mic' : 'Unmute Mic'}
            >
              {micOn ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Microphone & Speaker Settings"
                  >
                    <ChevronUp size={14} />
                  </button>
                }
              />
              <PopoverContent side="top" sideOffset={12} className="w-72 p-3 space-y-3 border-border bg-card shadow-xl" align="center">
                <div className="font-bold text-xs text-foreground border-b border-border pb-1.5">
                  Audio Device Preferences
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground block">Microphone</label>
                  <Select value={selectedMic} onValueChange={(val) => { if (typeof val === 'string') setSelectedMic(val); }}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select Microphone" />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {audioInputs.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || `Microphone ${d.deviceId.slice(0, 4)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground block">Speaker</label>
                  <Select value={selectedSpeaker} onValueChange={(val) => { if (typeof val === 'string') setSelectedSpeaker(val); }}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select Speaker" />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {audioOutputs.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || `Speaker ${d.deviceId.slice(0, 4)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Camera Split Button Group with Device Selector Chevron */}
          <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setCameraOn((on: boolean) => {
                  const next = !on;
                  rtc.setVideoEnabled(next);
                  return next;
                });
              }}
              className={`flex size-9 items-center justify-center rounded-full transition-colors cursor-pointer ${cameraOn ? 'bg-secondary text-foreground hover:bg-muted' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              title={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Camera Settings"
                  >
                    <ChevronUp size={14} />
                  </button>
                }
              />
              <PopoverContent side="top" sideOffset={12} className="w-72 p-3 space-y-3 border-border bg-card shadow-xl" align="center">
                <div className="font-bold text-xs text-foreground border-b border-border pb-1.5">
                  Camera Device Preferences
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground block">Camera</label>
                  <Select value={selectedCamera} onValueChange={(val) => { if (typeof val === 'string') setSelectedCamera(val); }}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select Camera" />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {videoInputs.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 4)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Screen Share Button */}
          <button
            type="button"
            onClick={async () => {
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
            className={`flex size-10 items-center justify-center rounded-full border transition-colors cursor-pointer ${rtc.isScreenSharing
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
              : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
            title={rtc.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <MonitorUp size={18} />
          </button>

          {/* Hand Raise Button (Google Meet style) */}
          <button
            type="button"
            onClick={() => setHandRaised(!handRaised)}
            className={`flex size-10 items-center justify-center rounded-full border transition-all cursor-pointer ${handRaised
              ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-105'
              : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
            title={handRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand size={18} />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Leave Button */}
          <Button
            variant="destructive"
            className="rounded-full px-4 h-10 font-bold gap-1.5 shadow-md cursor-pointer"
            onClick={() => setShowLeaveModal(true)}
          >
            <PhoneOff size={16} />
            <span>Leave</span>
          </Button>

          {/* Vertical Separator after Leave button */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Panel Navigation Buttons (People, Chat, Q&A, Polls) */}
          <div className="flex items-center gap-1.5">
            {PANELS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPanel(item.key)}
                className={`flex size-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${panel === item.key
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                title={item.label}
              >
                <item.icon size={16} />
              </button>
            ))}

            {/* Appearance / View Mode Settings */}
            <Popover open={showSettingsModal} onOpenChange={setShowSettingsModal}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                    title="Meeting View Settings"
                  >
                    <Settings size={16} />
                  </button>
                }
              />
              <PopoverContent side="top" sideOffset={12} className="w-72 p-4 space-y-3 border-border bg-card shadow-xl" align="end">
                <div className="font-bold text-xs text-foreground border-b border-border pb-2">
                  Appearance & Layout
                </div>
                <div className="space-y-2 text-xs">
                  <label className="text-[11px] font-semibold text-muted-foreground block">Video Tile Arrangement</label>
                  <Button
                    variant={layoutMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full justify-start text-xs font-semibold"
                    onClick={() => setLayoutMode('grid')}
                  >
                    Grid View (Google Meet style)
                  </Button>
                  <Button
                    variant={layoutMode === 'focus' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full justify-start text-xs font-semibold"
                    onClick={() => setLayoutMode('focus')}
                  >
                    Speaker / Focus View (Zoom style)
                  </Button>
                  <Button
                    variant={layoutMode === 'compact' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full justify-start text-xs font-semibold"
                    onClick={() => setLayoutMode('compact')}
                  >
                    Compact UI
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </footer>

      {/* Leave Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Leave Meeting?</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to exit the current meeting session?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowLeaveModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmLeave}>
                Leave Meeting
              </Button>
            </div>
          </div>
        </div>
      )}

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
