import React from 'react';
import {
  Users, Copy, Check, Mic, MicOff, Video, VideoOff, MonitorUp,
  MoreHorizontal, PhoneOff, MessageSquare, FileText, BarChart3, Sparkles,
  Lock, Hand, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { getMeetingStatusTone, getMeetingJoinModeLabel } from '@/lib/status-tone';
import { parseApiError } from '@/utils/apiError';
import { getMeetingById, leaveMeeting } from '@/api/meeting/meeting.api';
import { MeetingParticipants } from '@/components/meetings/MeetingParticipants';
import { ParticipantSettingsModal, type ParticipantPermissions } from '@/components/meetings/ParticipantSettingsModal';
import { MeetingQuestions } from '@/components/meetings/MeetingQuestions';
import { MeetingPolls } from '@/components/meetings/MeetingPolls';
import type { Meeting, MeetingParticipant } from '@/api/meeting/meeting.types';
import type { MeetingQuestion } from '@/api/meeting/meeting-qa.api';
import type { MeetingPoll } from '@/api/meeting/meeting-poll.api';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';

/** Bottom-bar controls. Icons stay bare; only Leave is a filled action. */
const ControlButton = ({
  icon, label, onClick, disabled, active,
}: {
  icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; active?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className={active ? 'text-emerald-600 dark:text-emerald-400' : undefined}>{icon}</span>
  </button>
);

/** One video tile. A locked tile means the camera is off or not permitted. */
const VideoTile = ({ name, isYou, host, muted, cameraOn }: {
  name: string; isYou: boolean; host: boolean; muted: boolean; cameraOn: boolean;
}) => (
  <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
    {cameraOn ? (
      <div className="flex size-full items-center justify-center text-muted-foreground">
        <Video size={26} strokeWidth={1.5} />
      </div>
    ) : (
      <Lock size={26} strokeWidth={1.5} className="text-muted-foreground" />
    )}

    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
      <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {name}{isYou ? ' (You)' : ''}
      </span>
      {host && (
        <span className="rounded-sm bg-amber-500/90 px-1.5 py-0.5 text-[11px] font-medium text-white">
          Host
        </span>
      )}
      {muted && <MicOff size={12} className="text-white" aria-label="Muted" />}
    </div>
  </div>
);

const PANELS = [
  { key: 'people', label: 'People', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'docs', label: 'Documents', icon: FileText },
  { key: 'polls', label: 'Polls', icon: BarChart3 },
  { key: 'ai', label: 'AI summary', icon: Sparkles },
] as const;

type PanelKey = (typeof PANELS)[number]['key'];

export const MeetingRoom: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [panel, setPanel] = useState<PanelKey>('people');
  const [editing, setEditing] = useState<MeetingParticipant | null>(null);
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const { data: meeting, loading, error } = useQuery<Meeting>(
    queryKeys.meetings.detail(id),
    () => getMeetingById(id),
    { enabled: isAuthenticated && Boolean(id) }
  );

  const questions = useQuery<MeetingQuestion[]>(
    queryKeys.meetings.questions(id),
    async () => {
      const { getMeetingQuestions } = await import('@/api/meeting/meeting-qa.api');
      return getMeetingQuestions(id);
    },
    { enabled: isAuthenticated && Boolean(id) && panel === 'chat', list: true }
  );

  const polls = useQuery<MeetingPoll[]>(
    queryKeys.meetings.polls(id),
    async () => {
      const { getMeetingPolls } = await import('@/api/meeting/meeting-poll.api');
      return getMeetingPolls(id);
    },
    { enabled: isAuthenticated && Boolean(id) && panel === 'polls', list: true }
  );

  const me = meeting?.participants.find((p) => p.userId === user?.userId);
  const canManage =
    me?.participantRole === 'HOST' || me?.participantRole === 'MODERATOR' || meeting?.createdBy === user?.userId;
  const canPost = me?.canUseChat ?? false;
  const joinUrl = meeting ? `${window.location.origin}/meetings/join/${meeting.meetingJoinCode}` : '';

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const leaving = useMutation<unknown, void>({
    mutationFn: () => leaveMeeting(id),
    onSuccess: () => navigate('/meetings'),
  });

  const savePermissions = useMutation<Meeting, [string, ParticipantPermissions]>({
    mutationFn: ([participantId, permissions]) =>
      import('@/api/meeting/meeting.api').then((m) =>
        m.updateParticipantSettings(id, participantId, permissions)
      ),
    onSuccess: () => setEditing(null),
  });

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
        <Button variant="outline" onClick={() => navigate('/meetings')}>Back to meetings</Button>
      </div>
    );
  }


  const joined = meeting.participants.filter((p) => p.participantStatus !== 'LEFT');

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="truncate text-sm font-bold">{meeting.meetingTitle}</h1>
        <code className="rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {meeting.meetingJoinCode.slice(0, 8)}
        </code>
        <Badge tone={getMeetingStatusTone(meeting.meetingStatus)}>
          {meeting.meetingStatus.toLowerCase()}
        </Badge>
        <Badge tone="neutral">{getMeetingJoinModeLabel(meeting.meetingJoinMode)}</Badge>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users size={14} strokeWidth={1.75} />
            {joined.length}/{meeting.meetingParticipantLimit}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            {joined.map((participant) => (
              <VideoTile
                key={participant.userId}
                name={participant.userId === user?.userId ? (user?.userName ?? 'You') : participant.userId}
                isYou={participant.userId === user?.userId}
                host={participant.participantRole === 'HOST'}
                muted={!participant.canSendAudio}
                cameraOn={participant.canSendVideo}
              />
            ))}
          </div>

          <div className="flex w-full max-w-2xl items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span>Screen share is available to permitted participants</span>
            <span aria-hidden="true">·</span>
            <span>Recording is capped at 60 seconds</span>
          </div>
        </main>


        <aside className="w-full shrink-0 border-t border-border p-4 lg:w-96 lg:border-l lg:border-t-0">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {PANELS.find((p) => p.key === panel)?.label}
          </h2>

          {panel === 'people' && (
            <MeetingParticipants
              participants={meeting.participants}
              canManage={Boolean(canManage)}
              onEditSettings={setEditing}
            />
          )}

          {panel === 'chat' && (
            <MeetingQuestions
              meetingId={meeting.meetingId}
              questions={questions.data}
              loading={questions.loading}
              error={questions.error}
              canPost={canPost}
              posting={false}
              onAsk={async () => undefined}
              onAnswer={async () => undefined}
              onDismiss={async () => undefined}
            />
          )}

          {panel === 'polls' && (
            <MeetingPolls
              polls={polls.data}
              loading={polls.loading}
              error={polls.error}
              canManage={Boolean(canManage)}
              pending={false}
              onCreate={async () => undefined}
              onVote={async () => undefined}
              onClose={async () => undefined}
            />
          )}

          {panel === 'docs' && (
            <p className="text-xs text-muted-foreground">
              Meeting documents appear here. Nothing has been shared yet.
            </p>
          )}

          {panel === 'ai' && (
            <p className="text-xs text-muted-foreground">
              The AI summary is generated once the meeting ends and the recording has been
              transcribed. Start a recording from the control bar to enable it.
            </p>
          )}
        </aside>
      </div>


      <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <Badge tone="danger">Record</Badge>

        <div className="ml-auto flex items-center gap-2">
          <ControlButton
            icon={micOn ? <Mic size={16} strokeWidth={1.75} /> : <MicOff size={16} strokeWidth={1.75} />}
            label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            onClick={() => setMicOn((on) => !on)}
            disabled={me ? !me.canSendAudio : false}
            active={micOn}
          />
          <ControlButton
            icon={cameraOn ? <Video size={16} strokeWidth={1.75} /> : <VideoOff size={16} strokeWidth={1.75} />}
            label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            onClick={() => setCameraOn((on) => !on)}
            disabled={me ? !me.canSendVideo : false}
            active={cameraOn}
          />
          <ControlButton
            icon={<MonitorUp size={16} strokeWidth={1.75} />}
            label="Share screen"
            disabled={me ? !me.canShareScreen : false}
          />
          <ControlButton icon={<MoreHorizontal size={16} strokeWidth={1.75} />} label="More options" />
          <ControlButton
            icon={<Hand size={16} strokeWidth={1.75} />}
            label={handRaised ? 'Lower hand' : 'Raise hand'}
            onClick={() => setHandRaised((raised) => !raised)}
            active={handRaised}
          />

          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() => leaving.mutate()}
            disabled={leaving.pending}
          >
            <PhoneOff size={16} />
            {leaving.pending ? 'Leaving…' : 'Leave'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {PANELS.map((item) => (
            <ControlButton
              key={item.key}
              icon={<item.icon size={16} strokeWidth={1.75} />}
              label={item.label}
              onClick={() => setPanel(item.key)}
              active={panel === item.key}
            />
          ))}
          {canManage && (
            <ControlButton icon={<Settings size={16} strokeWidth={1.75} />} label="Meeting settings" />
          )}
        </div>
      </footer>

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
