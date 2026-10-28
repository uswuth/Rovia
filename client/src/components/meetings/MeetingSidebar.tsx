import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MeetingParticipants } from './MeetingParticipants';
import { MeetingChat } from './MeetingChat';
import { MeetingQuestions } from './MeetingQuestions';
import { MeetingPolls } from './MeetingPolls';
import { PANELS, type PanelKey } from './meetingPanels';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';
import type { MeetingQuestion } from '@/api/meeting/meeting-qa.api';
import type { MeetingPoll } from '@/api/meeting/meeting-poll.api';
import type { MeetingChatMessage, RaisedHand } from '@/api/meeting/webrtc.types';

export interface MeetingSidebarProps {
  panel: PanelKey;
  onSetPanel: (panel: PanelKey) => void;
  onClose?: () => void;
  joined: MeetingParticipant[];
  canManage: boolean;
  isHost?: boolean;
  onEditParticipant: (participant: MeetingParticipant) => void;
  currentUserId?: string;
  currentUserName?: string;
  onToggleMuteParticipant?: (participant: MeetingParticipant) => void;
  onRemoveParticipant?: (userId: string) => void;
  localMicOn?: boolean;
  peers?: Record<string, { stream: MediaStream | null; audioEnabled?: boolean; videoEnabled?: boolean }>;
  meetingId: string;
  canPost: boolean;
  onToast: (message: string) => void;
  getParticipantDisplayName: (p: { userId?: string }) => string;
  getParticipantEmail?: (p: { userId?: string }) => string | undefined;
  getParticipantMeetingRole?: (p: { userId?: string }) => 'Host' | 'Moderator' | 'Member';
  participants: MeetingParticipant[];
  isTopAdmin: boolean;
  questions: {
    data?: MeetingQuestion[];
    loading: boolean;
    error: unknown;
  };
  qaPending: boolean;
  onAskQuestion: (text: string) => Promise<void>;
  onAnswerQuestion: (questionId: string, answer: string) => Promise<void>;
  onDismissQuestion: (questionId: string) => Promise<void>;
  polls: {
    data?: MeetingPoll[];
    loading: boolean;
    error: unknown;
  };
  pollPending: boolean;
  onCreatePoll: (question: string, options: string[]) => Promise<void>;
  onVotePoll: (pollId: string, optionIds: string[]) => Promise<void>;
  onClosePoll: (pollId: string) => Promise<void>;
  chatMessages?: MeetingChatMessage[];
  setChatMessages?: React.Dispatch<React.SetStateAction<MeetingChatMessage[]>>;
  raisedHands?: RaisedHand[];
  onLowerHand?: (userId?: string) => void;
}

/** Right sidebar container hosting People, Chat, Q&A, and Polls panels */
export const MeetingSidebar: React.FC<MeetingSidebarProps> = ({
  panel,
  onSetPanel,
  onClose,
  joined,
  canManage,
  isHost,
  onEditParticipant,
  currentUserId,
  currentUserName,
  onToggleMuteParticipant,
  onRemoveParticipant,
  localMicOn,
  peers,
  meetingId,
  canPost,
  onToast,
  getParticipantDisplayName,
  getParticipantEmail,
  getParticipantMeetingRole,
  participants,
  questions,
  qaPending,
  onAskQuestion,
  onAnswerQuestion,
  onDismissQuestion,
  polls,
  pollPending,
  onCreatePoll,
  onVotePoll,
  onClosePoll,
  chatMessages,
  setChatMessages,
  raisedHands,
  onLowerHand,
}) => {
  const activePoll = React.useMemo(
    () => polls.data?.find((p) => p.pollStatus === 'OPEN') ?? null,
    [polls.data]
  );

  return (
    <aside className="w-full h-full px-4 pt-4 pb-3 bg-card flex flex-col min-h-0 self-stretch overflow-hidden">
      <div className="flex items-center justify-between border-b border-border pb-2 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {PANELS.find((p) => p.key === panel)?.label || (panel === 'polls' ? 'Polls' : '')}
          </h2>
          {panel === 'chat' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/meetings/${meetingId}/summary`, '_blank')}
              className="h-6 px-1.5 gap-1 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
              title="Open AI Meeting Summary in new page"
            >
              <Sparkles size={12} />
              <span>AI Summary</span>
            </Button>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-sm"
            title="Close panel"
          >
            <X size={14} />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {panel === 'people' && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 no-scrollbar">
            <MeetingParticipants
              participants={joined}
              canManage={canManage}
              isHost={isHost}
              onEditSettings={onEditParticipant}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onToggleMuteParticipant={onToggleMuteParticipant}
              onRemoveParticipant={onRemoveParticipant}
              localMicOn={localMicOn}
              peers={peers}
              raisedHands={raisedHands}
              onLowerHand={onLowerHand}
            />
          </div>
        )}

        <div className={cn("flex-1 min-h-0 flex flex-col overflow-hidden", panel !== 'chat' && "hidden")}>
          <MeetingChat
            meetingId={meetingId}
            currentUserId={currentUserId ?? ''}
            canPost={canPost}
            canManage={canManage}
            onError={onToast}
            displayNameFor={(userId) => getParticipantDisplayName({ userId })}
            emailFor={(userId) => getParticipantEmail?.({ userId })}
            meetingRoleFor={(userId) => getParticipantMeetingRole?.({ userId }) ?? "Member"}
            participants={participants}
            canViewProfile={true}
            onOpenPolls={() => onSetPanel('polls')}
            activePoll={activePoll}
            onVotePoll={onVotePoll}
            onClosePoll={onClosePoll}
            pollPending={pollPending}
            messages={chatMessages}
            setMessages={setChatMessages}
          />
        </div>

        {panel === 'qa' && (
          <MeetingQuestions
            meetingId={meetingId}
            questions={questions.data}
            loading={questions.loading}
            error={questions.error}
            canPost={canPost}
            canManage={canManage}
            posting={qaPending}
            onAsk={onAskQuestion}
            onAnswer={onAnswerQuestion}
            onDismiss={onDismissQuestion}
            displayNameFor={(userId) => getParticipantDisplayName({ userId })}
            getParticipantAvatar={(userId) => {
              const p = participants.find((item) => item.userId === userId);
              return p?.avatarUrl;
            }}
            currentUserId={currentUserId}
            participants={participants}
          />
        )}

        {panel === 'polls' && (
          <div className="flex flex-col h-full min-h-0">
            <MeetingPolls
              polls={polls.data}
              loading={polls.loading}
              error={polls.error}
              canManage={canManage}
              pending={pollPending}
              onCreate={onCreatePoll}
              onVote={onVotePoll}
              onClose={onClosePoll}
              onBackToChat={() => onSetPanel('chat')}
              currentUserId={currentUserId}
              displayNameFor={(userId) => getParticipantDisplayName({ userId })}
              getParticipantAvatar={(userId) => {
                const m = participants.find((p) => p.userId === userId);
                return m && 'avatarUrl' in m ? (m.avatarUrl as string) : undefined;
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
