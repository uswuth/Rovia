
interface PollListProps {
  polls: MeetingPoll[];
  canManage: boolean;
  pending: boolean;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
}

const PollList = ({ polls, canManage, pending, onVote, onClose }: PollListProps) => (
  <ul className="space-y-2">
    {polls.map((poll) => (
      <li key={poll.pollId} className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-foreground">{poll.pollQuestion}</p>
          <Badge tone={getPollStatusTone(poll.pollStatus)}>{poll.pollStatus.toLowerCase()}</Badge>
        </div>

        <ul className="mt-2 space-y-1">
          {poll.pollOptions.map((option) => (
            <li key={option.optionId}>
              <button
                type="button"
                disabled={poll.pollStatus === 'CLOSED' || pending}
                onClick={() => onVote(poll.pollId, [option.optionId])}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{option.optionText}</span>
                <span className="tabular-nums text-muted-foreground">{option.voteCount}</span>
              </button>
            </li>
          ))}
        </ul>

        {poll.pollMultipleChoice && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Multiple selections allowed. Voting again replaces your previous choice.
          </p>
        )}

        {canManage && poll.pollStatus === 'OPEN' && (
          <Button
            variant="ghost"
            size="xs"
            className="mt-1.5"
            onClick={() => onClose(poll.pollId)}
            disabled={pending}
          >
            Close poll
          </Button>
        )}
      </li>
    ))}
  </ul>
);

import { useState } from 'react';
import { BarChart3, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { getPollStatusTone } from '@/lib/status-tone';
import { parseApiError } from '@/utils/apiError';
import type { MeetingPoll } from '@/api/meeting/meeting-poll.api';

interface MeetingPollsProps {
  polls: MeetingPoll[] | undefined;
  loading: boolean;
  error: unknown;
  /** Only a host or moderator may create or close a poll. */
  canManage: boolean;
  onCreate: (pollQuestion: string, options: string[], multipleChoice: boolean) => Promise<void>;
  onVote: (pollId: string, optionIds: string[]) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
  pending: boolean;
}

const MAX_OPTIONS = 10;

export const MeetingPolls = ({
  polls,
  loading,
  error,
  canManage,
  onCreate,
  onVote,
  onClose,
  pending,
}: MeetingPollsProps) => {
  const [composing, setComposing] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    await onCreate(question.trim(), cleaned, multipleChoice);
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
    setComposing(false);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        {parseApiError(error).message}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {canManage && !composing && (
        <Button variant="outline" size="sm" onClick={() => setComposing(true)}>
          <Plus size={14} />
          New poll
        </Button>
      )}

      {composing && (
        <div className="space-y-3 rounded-md border border-border bg-card p-3">
          <FormField label="Poll question" htmlFor="poll-question" required>
            <Input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Which day should we ship?"
            />
          </FormField>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Options</p>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Option ${index + 1}`}
                  value={option}
                  onChange={(event) =>
                    setOptions((prev) => prev.map((o, i) => (i === index ? event.target.value : o)))
                  }
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button variant="ghost" size="xs" onClick={() => setOptions((prev) => [...prev, ''])}>
                <Plus size={12} />
                Add option
              </Button>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={multipleChoice}
              onChange={(event) => setMultipleChoice(event.target.checked)}
            />
            Allow multiple selections
          </label>

          {localError && (
            <p role="alert" className="text-xs text-destructive">
              {localError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} disabled={pending}>
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
          description="Polls are visible to everyone on the roster. Votes are counted, never attributed."
        />
      ) : (
        <PollList polls={polls} canManage={canManage} pending={pending} onVote={onVote} onClose={onClose} />
      )}
    </div>
  );
}
