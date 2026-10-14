import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronUp, MessageCircleQuestion, SendHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuestionStatusTone } from '@/lib/status-tone';
import { parseApiError } from '@/utils/apiError';
import { askQuestionSchema, answerQuestionSchema } from '@/schemas/meeting.schema';
import { useScrollFade } from '@/hooks/useScrollFade';
import { cn } from '@/lib/utils';
import type { z } from 'zod';
import type { MeetingQuestion } from '@/api/meeting/meeting-qa.api';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

type AskValues = z.infer<typeof askQuestionSchema>;
type AnswerValues = z.infer<typeof answerQuestionSchema>;

interface QuestionListProps {
  questions: MeetingQuestion[];
  canPost: boolean;
  canManage?: boolean;
  posting: boolean;
  cooldown: number;
  answerFor: string | null;
  onStartAnswer: (questionId: string) => void;
  onCancelAnswer: () => void;
  onSubmitAnswer: (questionId: string) => () => Promise<void>;
  onDismiss: (questionId: string) => Promise<void>;
  answerForm: ReturnType<typeof useForm<AnswerValues>>;
  displayNameFor?: (userId: string) => string;
  getParticipantAvatar?: (userId: string) => string | undefined;
  currentUserId?: string;
  participants?: MeetingParticipant[];
}

/** Format time relative to now (e.g. "just now", "2 mins ago", "1 hour ago") similar to YouTube */
const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    if (isNaN(date)) return '';
    const diffSec = Math.max(0, Math.floor((now - date) / 1000));
    if (diffSec < 45) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
};

const QuestionList = ({
  questions,
  canPost,
  canManage,
  posting,
  cooldown,
  answerFor,
  onStartAnswer,
  onCancelAnswer,
  onSubmitAnswer,
  onDismiss,
  answerForm,
  displayNameFor,
  getParticipantAvatar,
  currentUserId,
  participants,
}: QuestionListProps) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const answerDraft = useWatch({ control: answerForm.control, name: 'answerText' });

  const toggleExpand = (questionId: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const getUserInfo = (userId?: string) => {
    if (!userId) return { name: 'Participant', avatarUrl: undefined, isYou: false };
    const isYou = userId === currentUserId;
    const participant = participants?.find((p) => p.userId === userId);
    let name = displayNameFor?.(userId) || participant?.userName;
    if (!name || name === userId) {
      name = userId.length > 20 ? `User (${userId.slice(-4)})` : userId;
    }
    const avatarUrl = getParticipantAvatar?.(userId) || participant?.avatarUrl;
    return { name, avatarUrl, isYou };
  };

  return (
    <ul className="space-y-3">
      {questions.map((question) => {
        const asker = getUserInfo(question.askedBy);
        const totalAnswers = question.answers?.length || 0;
        const isExpanded = Boolean(expandedQuestions[question.questionId]);
        const answersToShow = isExpanded ? question.answers : question.answers?.slice(0, 1);
        const hasMoreAnswers = totalAnswers > 1;
        const canDismiss = Boolean(canManage || (question.askedBy && question.askedBy === currentUserId));

        return (
          <li
            key={question.questionId}
            className="rounded-xs border border-border/80 bg-card p-3 shadow-xs transition-all space-y-2.5"
          >
            {/* Root: The Question Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-6 rounded-full ring-1 ring-border/60 shrink-0">
                  {asker.avatarUrl && <AvatarImage src={asker.avatarUrl} alt={asker.name} />}
                  <AvatarFallback
                    name={asker.name}
                    className={cn('text-[9px] font-bold', getAvatarColorByName(asker.name))}
                  >
                    {asker.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <span className="font-semibold text-foreground truncate">
                    {asker.name}
                    {asker.isYou ? ' (You)' : ''}
                  </span>
                  {formatRelativeTime(question.createdAt) ? (
                    <span className="text-muted-foreground/70 text-[11px] shrink-0">
                      {formatRelativeTime(question.createdAt)}
                    </span>
                  ) : null}
                </div>
              </div>
              <Badge tone={getQuestionStatusTone(question.questionStatus)} className="rounded-xs text-[10px] shrink-0">
                {question.questionStatus.toLowerCase()}
              </Badge>
            </div>

            {/* Root Question Body (Aligned under the author, with continuous tree trunk line if answers exist) */}
            <div className="relative pl-8">
              {totalAnswers > 0 && (
                <span className="absolute left-3 -top-2.5 -bottom-2.5 w-px bg-border/80 dark:border-zinc-700/60 pointer-events-none" />
              )}
              <p className="text-xs font-normal text-foreground leading-relaxed select-text">
                {question.questionText}
              </p>
            </div>

            {/* Tree Branch: Answers with Natural YouTube-style connectors */}
            {totalAnswers > 0 && (
              <div className="relative ml-3 pl-4 border-l border-border/80 dark:border-zinc-700/60 space-y-2.5 mt-2.5 pt-0.5">
                {answersToShow?.map((answer, index) => {
                  const ansUser = getUserInfo(answer.userId);
                  const ansTime = formatRelativeTime(answer.createdAt);
                  return (
                    <div key={`${question.questionId}-${index}`} className="relative flex items-start gap-2.5">
                      {/* Curved elbow connector from parent vertical branch into reply avatar center */}
                      <span className="absolute -left-4 top-0 w-3.5 h-[11px] border-b border-l border-border/80 dark:border-zinc-700/60 rounded-bl-md pointer-events-none" />

                      {/* Reply User Avatar */}
                      <Avatar className="size-5 rounded-full ring-1 ring-border/60 shrink-0 mt-0.5">
                        {ansUser.avatarUrl && <AvatarImage src={ansUser.avatarUrl} alt={ansUser.name} />}
                        <AvatarFallback
                          name={ansUser.name}
                          className={cn('text-[8px] font-bold', getAvatarColorByName(ansUser.name))}
                        >
                          {ansUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Reply Content Block (Name aligned with avatar top, answer text close underneath) */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                          <span className="font-semibold text-foreground truncate text-[11px]">
                            {ansUser.name}
                            {ansUser.isYou ? ' (You)' : ''}
                          </span>
                          {ansTime ? (
                            <span className="text-muted-foreground/70 text-[10px] shrink-0">
                              {ansTime}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed select-text break-words">
                          {answer.answerText}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Tree Branch Toggle: YouTube style "View replies" / "Hide replies" */}
                {hasMoreAnswers && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(question.questionId)}
                    className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <span>Hide replies</span>
                        <ChevronUp size={13} />
                      </>
                    ) : (
                      <>
                        <span>View {totalAnswers - 1} more {totalAnswers - 1 === 1 ? 'reply' : 'replies'}</span>
                        <ChevronDown size={13} />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Answer Input Form or Action Triggers */}
            {canPost && question.questionStatus !== 'DISMISSED' && (
              <div className="pl-8 pt-1">
                {answerFor === question.questionId ? (
                  <form
                    onSubmit={onSubmitAnswer(question.questionId)}
                    className="rounded-xs border border-border/80 bg-muted/20 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Your answer</span>
                      <button
                        type="button"
                        onClick={onCancelAnswer}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Cancel answer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {/* Aligned input and post button */}
                    <div className="flex items-center gap-1.5 w-full">
                      <Input
                        id={`answer-${question.questionId}`}
                        placeholder="Write your answer..."
                        {...answerForm.register('answerText')}
                        className="h-8 flex-1 min-w-0 px-2.5 text-xs rounded-xs border-border bg-card focus:outline-none focus:border-emerald-500 focus-visible:outline-none focus-visible:border-emerald-500 focus-visible:ring-0"
                        disabled={posting || cooldown > 0}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="xs"
                        className="h-8 px-3 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 shrink-0"
                        disabled={posting || cooldown > 0 || !answerDraft?.trim()}
                      >
                        {cooldown > 0 ? `Wait ${cooldown}s` : 'Post'}
                      </Button>
                    </div>
                    {answerForm.formState.errors.answerText?.message && (
                      <p className="text-[10px] text-destructive pl-0.5">
                        {answerForm.formState.errors.answerText.message}
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      className="rounded-xs h-7 text-[11px] cursor-pointer"
                      onClick={() => onStartAnswer(question.questionId)}
                      disabled={posting || cooldown > 0}
                      title={cooldown > 0 ? `Please wait ${cooldown}s before answering again` : undefined}
                    >
                      {cooldown > 0 ? `Answer (${cooldown}s)` : 'Answer'}
                    </Button>

                    {/* Only show Dismiss button if current user is host/manager or the asker */}
                    {canDismiss && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="rounded-xs h-7 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => onDismiss(question.questionId)}
                        disabled={posting}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

interface MeetingQuestionsProps {
  meetingId: string;
  questions: MeetingQuestion[] | undefined;
  loading: boolean;
  error: unknown;
  /** False when the host has disabled chat for this member. */
  canPost: boolean;
  canManage?: boolean;
  onAsk: (questionText: string) => Promise<void>;
  onAnswer: (questionId: string, answerText: string) => Promise<void>;
  onDismiss: (questionId: string) => Promise<void>;
  posting: boolean;
  displayNameFor?: (userId: string) => string;
  getParticipantAvatar?: (userId: string) => string | undefined;
  currentUserId?: string;
  participants?: MeetingParticipant[];
}

export const MeetingQuestions = ({
  meetingId,
  questions,
  loading,
  error,
  canPost = true,
  canManage = false,
  onAsk,
  onAnswer,
  onDismiss,
  posting,
  displayNameFor,
  getParticipantAvatar,
  currentUserId,
  participants,
}: MeetingQuestionsProps) => {
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const scrollFadeRef = useScrollFade<HTMLDivElement>({ size: 32 });

  // 15-second cooldown timer after submitting an answer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const askForm = useForm<AskValues>({
    resolver: zodResolver(askQuestionSchema),
    defaultValues: { questionText: '' },
  });
  const answerForm = useForm<AnswerValues>({
    resolver: zodResolver(answerQuestionSchema),
    defaultValues: { answerText: '' },
  });
  const questionText = useWatch({ control: askForm.control, name: 'questionText' });

  const submitQuestion = askForm.handleSubmit(async (values) => {
    await onAsk(values.questionText.trim());
    askForm.reset();
  });

  const submitAnswer = (questionId: string) =>
    answerForm.handleSubmit(async (values) => {
      if (cooldown > 0) return;
      await onAnswer(questionId, values.answerText.trim());
      answerForm.reset();
      setAnswerFor(null);
      setCooldown(15);
    });

  return (
    <div className="flex flex-col h-full min-h-0 w-full justify-between">
      <div ref={scrollFadeRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-3 no-scrollbar scroll-fade-y">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {parseApiError(error).message}
          </p>
        ) : !questions?.length ? (
          <EmptyState
            icon={MessageCircleQuestion}
            title="No questions yet"
            description="Questions asked here are visible to everyone on the roster."
          />
        ) : (
          <QuestionList
            questions={questions}
            canPost={canPost}
            canManage={canManage}
            posting={posting}
            cooldown={cooldown}
            answerFor={answerFor}
            onStartAnswer={setAnswerFor}
            onCancelAnswer={() => setAnswerFor(null)}
            onSubmitAnswer={submitAnswer}
            onDismiss={onDismiss}
            answerForm={answerForm}
            displayNameFor={displayNameFor}
            getParticipantAvatar={getParticipantAvatar}
            currentUserId={currentUserId}
            participants={participants}
          />
        )}
      </div>

      {canManage && (
        <div className="shrink-0 pt-1 pb-1 mt-auto flex flex-col justify-end w-full">
          <form onSubmit={submitQuestion} className="w-full">
            <div className="flex items-center gap-2 w-full">
              <Input
                id={`ask-${meetingId}`}
                type="text"
                placeholder="Ask a question for the meeting..."
                {...askForm.register('questionText')}
                disabled={posting}
                className="flex-1 min-w-0 h-9 px-3.5 text-xs rounded-xs border-border bg-card focus:outline-none focus:border-emerald-500 focus-visible:outline-none focus-visible:border-emerald-500 focus-visible:ring-0"
                aria-label="Question text"
              />
              <button
                type="submit"
                disabled={posting || !questionText?.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all"
                title="Send Question"
              >
                <SendHorizontal size={15} className="translate-x-[0.5px]" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
