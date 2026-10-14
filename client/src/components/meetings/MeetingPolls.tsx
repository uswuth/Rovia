import React, { useState } from 'react';
import { BarChart3, Plus, X, Users, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { getPollStatusTone } from '@/lib/status-tone';
import { parseApiError } from '@/utils/apiError';
import { cn } from '@/lib/utils';
import { useScrollFade } from '@/hooks/useScrollFade';
import type { MeetingPoll } from '@/api/meeting/meeting-poll.api';

interface PollListProps {
  polls: MeetingPoll[];
  canManage: boolean;
  pending: boolean;
  currentUserId?: string;
  displayNameFor?: (userId: string) => string;
  getParticipantAvatar?: (userId: string) => string | undefined;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
}

const PollItem: React.FC<{
  poll: MeetingPoll;
  canManage: boolean;
  pending: boolean;
  currentUserId?: string;
  displayNameFor?: (userId: string) => string;
  getParticipantAvatar?: (userId: string) => string | undefined;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
}> = ({
  poll,
  canManage,
  pending,
  currentUserId,
  displayNameFor,
  getParticipantAvatar,
  onVote,
  onClose,
}) => {
  const totalVotes = poll.pollOptions.reduce((acc, o) => acc + o.voteCount, 0);

  return (
    <li className="rounded-xs border border-border bg-card p-3.5 shadow-2xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-foreground leading-snug">{poll.pollQuestion}</p>
          <p className="text-[10px] text-muted-foreground">{totalVotes} total votes</p>
        </div>
        <Badge tone={getPollStatusTone(poll.pollStatus)}>{poll.pollStatus.toLowerCase()}</Badge>
      </div>

      <ul className="space-y-2">
        {(() => {
          const maxVotes = Math.max(0, ...poll.pollOptions.map((o) => o.voteCount));
          return poll.pollOptions.map((option) => {
            const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            const hasVotedThis = (option.voterIds || []).includes(currentUserId || '');
            const isLeader = option.voteCount > 0 && option.voteCount === maxVotes;
            const isTrailing = option.voteCount > 0 && option.voteCount < maxVotes;

            return (
              <li key={option.optionId} className="space-y-1.5">
                <button
                  type="button"
                  disabled={poll.pollStatus === 'CLOSED' || pending}
                  onClick={() => onVote(poll.pollId, [option.optionId])}
                  className={cn(
                    'relative w-full overflow-hidden rounded-xs border text-left p-2.5 transition-all',
                    poll.pollStatus === 'OPEN' ? 'cursor-pointer hover:border-emerald-500/60' : 'cursor-default opacity-90',
                    hasVotedThis
                      ? 'border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-300'
                      : 'border-border bg-muted/30 text-foreground'
                  )}
                >
                  {/* Background Progress Fill */}
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 transition-all duration-300 rounded-xs pointer-events-none',
                      isLeader && 'bg-emerald-500/20 border-r border-emerald-400/60',
                      isTrailing && 'bg-zinc-500/25 dark:bg-zinc-700/50 border-r border-zinc-400/50 dark:border-zinc-500/60'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                <div className="relative z-10 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    {hasVotedThis && <Check size={13} className="text-emerald-500 shrink-0" />}
                    <span className="truncate">{option.optionText}</span>
                  </span>
                  <span className="tabular-nums text-[11px] font-bold text-muted-foreground ml-2 shrink-0">
                    {option.voteCount} ({pct}%)
                  </span>
                </div>
              </button>

              {/* Voters List breakdown - host/manager only */}
              {canManage && option.voterIds && option.voterIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pl-1 pt-0.5">
                  <span className="text-[10px] text-muted-foreground/70 mr-1 flex items-center gap-1">
                    <Users size={10} />
                    <span>Voted:</span>
                  </span>
                  {option.voterIds.map((vId) => {
                    const vName = displayNameFor ? displayNameFor(vId) : vId.slice(-4);
                    const vAvatar = getParticipantAvatar ? getParticipantAvatar(vId) : undefined;
                    return (
                      <span
                        key={vId}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary/80 border border-border/60 px-2 py-0.5 text-[10px] text-secondary-foreground"
                        title={vName}
                      >
                        <Avatar className="size-3.5 text-[8px]">
                          {vAvatar && <AvatarImage src={vAvatar} alt={vName} />}
                          <AvatarFallback name={vName} className={cn("font-bold text-[7px]", getAvatarColorByName(vName))}>
                            {vName.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[80px]">{vName}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          );
        });
      })()}
      </ul>

      {canManage && poll.pollStatus === 'OPEN' && (
        <div className="flex justify-end pt-1">
          <Button
            variant="destructive"
            size="xs"
            className="cursor-pointer text-xs h-7 px-2.5 rounded-xs"
            onClick={() => onClose(poll.pollId)}
            disabled={pending}
          >
            Close poll
          </Button>
        </div>
      )}
    </li>
  );
};

const PollList: React.FC<PollListProps> = (props) => {
  const openPolls = props.polls.filter((p) => p.pollStatus === 'OPEN');
  const closedPolls = props.polls.filter((p) => p.pollStatus === 'CLOSED');

  return (
    <div className="space-y-4">
      {openPolls.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Active Poll
          </p>
          <ul className="space-y-3">
            {openPolls.map((poll) => (
              <PollItem key={poll.pollId} poll={poll} {...props} />
            ))}
          </ul>
        </div>
      )}

      {closedPolls.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Closed Session Polls ({closedPolls.length})
          </p>
          <ul className="space-y-3">
            {closedPolls.map((poll) => (
              <PollItem key={poll.pollId} poll={poll} {...props} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface MeetingPollsProps {
  polls: MeetingPoll[] | undefined;
  loading: boolean;
  error: unknown;
  /** Only host or moderator can create or close polls. */
  canManage: boolean;
  currentUserId?: string;
  displayNameFor?: (userId: string) => string;
  getParticipantAvatar?: (userId: string) => string | undefined;
  onCreate: (pollQuestion: string, options: string[]) => Promise<void>;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
  pending: boolean;
  onBackToChat?: () => void;
}

const MAX_OPTIONS = 10;

export const MeetingPolls: React.FC<MeetingPollsProps> = ({
  polls,
  loading,
  error,
  canManage,
  currentUserId,
  displayNameFor,
  getParticipantAvatar,
  onCreate,
  onVote,
  onClose,
  pending,
  onBackToChat,
}) => {
  const [composing, setComposing] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [localError, setLocalError] = useState<string | null>(null);
  const scrollFadeRef = useScrollFade<HTMLDivElement>({ size: 32 });

  const hasOpenPoll = (polls || []).some((p) => p.pollStatus === 'OPEN');

  const submit = async () => {
    const cleaned = options.map((option) => option.trim()).filter(Boolean);
    if (question.trim().length < 3) {
      setLocalError('Poll question must be at least 3 characters');
      return;
    }
    if (cleaned.length < 2) {
      setLocalError('Add at least two options');
      return;
    }
    setLocalError(null);
    await onCreate(question.trim(), cleaned);
    setQuestion('');
    setOptions(['', '']);
    setComposing(false);
  };

  const headerToolbar = (
    <div className="flex items-center justify-between pb-2.5 border-b border-border shrink-0">
      {onBackToChat ? (
        <Button
          variant="outline"
          size="xs"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-1 h-7 px-2 rounded-xs"
          onClick={onBackToChat}
        >
          <ArrowLeft size={13} />
          <span>Back to Chat</span>
        </Button>
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">In-Meeting Polls</span>
      )}

      {/* Repositioned New Poll Button (Primary with Accent Color) or Status */}
      {canManage && !composing && !hasOpenPoll && (
        <Button
          size="xs"
          onClick={() => setComposing(true)}
          className="cursor-pointer gap-1.5 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-7 px-2.5 shadow-xs transition-colors"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>New poll</span>
        </Button>
      )}

      {canManage && composing && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setComposing(false);
            setLocalError(null);
          }}
          className="cursor-pointer gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
        >
          <X size={13} />
          <span>Cancel</span>
        </Button>
      )}

      {canManage && hasOpenPoll && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-xs">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          Active Poll
        </span>
      )}

      {!canManage && (
        <span className="text-xs font-medium text-muted-foreground">In-Meeting Polls</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 space-y-3">
        {headerToolbar}
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-0 space-y-3">
        {headerToolbar}
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {parseApiError(error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {headerToolbar}

      <div ref={scrollFadeRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5 no-scrollbar scroll-fade-y">
        {/* One active poll limit rule notice */}
        {canManage && hasOpenPoll && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>Active poll in progress</span>
          </div>
        )}

        {canManage && composing && (
          <div className="space-y-3 rounded-xs border border-border bg-card p-3 shadow-xs">
            <FormField label="Poll question" htmlFor="poll-question" required>
              <Input
                id="poll-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question..."
                className="rounded-xs"
              />
            </FormField>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Options</p>
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    placeholder={`Option ${index + 1}`}
                    onChange={(event) =>
                      setOptions((prev) => prev.map((o, i) => (i === index ? event.target.value : o)))
                    }
                    className="rounded-xs"
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove option ${index + 1}`}
                      className="cursor-pointer rounded-xs"
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < MAX_OPTIONS && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setOptions((prev) => [...prev, ''])}
                  className="cursor-pointer rounded-xs"
                >
                  <Plus size={12} />
                  Add option
                </Button>
              )}
            </div>

            {localError && (
              <p role="alert" className="text-xs text-destructive">
                {localError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={submit}
                disabled={pending}
                className="cursor-pointer rounded-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors"
              >
                {pending ? 'Creating…' : 'Create poll'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setComposing(false);
                  setLocalError(null);
                }}
                disabled={pending}
                className="cursor-pointer rounded-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!polls?.length ? (
          <EmptyState
            icon={BarChart3}
            title="No polls yet"
            description="Polls are visible to everyone on the roster with real-time stats."
            actionLabel={canManage && !hasOpenPoll && !composing ? "Create Poll" : undefined}
            onAction={canManage && !hasOpenPoll && !composing ? () => setComposing(true) : undefined}
          />
        ) : (
          <PollList
            polls={polls}
            canManage={canManage}
            pending={pending}
            currentUserId={currentUserId}
            displayNameFor={displayNameFor}
            getParticipantAvatar={getParticipantAvatar}
            onVote={onVote}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};
