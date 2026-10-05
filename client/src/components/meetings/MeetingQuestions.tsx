import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircleQuestion, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuestionStatusTone } from '@/lib/status-tone';
import { parseApiError } from '@/utils/apiError';
import { askQuestionSchema, answerQuestionSchema } from '@/schemas/meeting.schema';
import type { z } from 'zod';
import type { MeetingQuestion } from '@/api/meeting/meeting-qa.api';

type AskValues = z.infer<typeof askQuestionSchema>;
type AnswerValues = z.infer<typeof answerQuestionSchema>;

interface QuestionListProps {
  questions: MeetingQuestion[];
  canPost: boolean;
  posting: boolean;
  answerFor: string | null;
  onStartAnswer: (questionId: string) => void;
  onCancelAnswer: () => void;
  onSubmitAnswer: (questionId: string) => () => Promise<void>;
  onDismiss: (questionId: string) => Promise<void>;
  answerForm: ReturnType<typeof useForm<AnswerValues>>;
}

const QuestionList = ({
  questions,
  canPost,
  posting,
  answerFor,
  onStartAnswer,
  onCancelAnswer,
  onSubmitAnswer,
  onDismiss,
  answerForm,
}: QuestionListProps) => (
  <ul className="space-y-2">
    {questions.map((question) => (
      <li key={question.questionId} className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-foreground">{question.questionText}</p>
          <Badge tone={getQuestionStatusTone(question.questionStatus)}>
            {question.questionStatus.toLowerCase()}
          </Badge>
        </div>

        {question.answers?.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
            {question.answers.map((answer, index) => (
              <li key={`${question.questionId}-${index}`} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{answer.userId}</span> {answer.answerText}
              </li>
            ))}
          </ul>
        )}

        {canPost && question.questionStatus !== 'DISMISSED' && (
          <div className="mt-2">
            {answerFor === question.questionId ? (
              <form onSubmit={onSubmitAnswer(question.questionId)} className="flex items-start gap-2">
                <FormField
                  label="Your answer"
                  htmlFor={`answer-${question.questionId}`}
                  className="flex-1"
                  error={answerForm.formState.errors.answerText?.message}
                >
                  <Input
                    id={`answer-${question.questionId}`}
                    {...answerForm.register('answerText')}
                  />
                </FormField>
                <Button type="submit" size="sm" className="mt-[1.375rem]" disabled={posting}>
                  Post
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-[1.375rem]"
                  onClick={onCancelAnswer}
                  aria-label="Cancel answer"
                >
                  <X size={14} />
                </Button>
              </form>
            ) : (
              <>
                <Button variant="outline" size="xs" onClick={() => onStartAnswer(question.questionId)}>
                  Answer
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onDismiss(question.questionId)}
                  disabled={posting}
                >
                  Dismiss
                </Button>
              </>
            )}
          </div>
        )}
      </li>
    ))}
  </ul>
);

interface MeetingQuestionsProps {
  meetingId: string;
  questions: MeetingQuestion[] | undefined;
  loading: boolean;
  error: unknown;
  /** False when the host has disabled chat for this member. */
  canPost: boolean;
  onAsk: (questionText: string) => Promise<void>;
  onAnswer: (questionId: string, answerText: string) => Promise<void>;
  onDismiss: (questionId: string) => Promise<void>;
  posting: boolean;
}

export const MeetingQuestions = ({
  meetingId,
  questions,
  loading,
  error,
  canPost = true,
  onAsk,
  onAnswer,
  onDismiss,
  posting,
}: MeetingQuestionsProps) => {
  const [answerFor, setAnswerFor] = useState<string | null>(null);

  const askForm = useForm<AskValues>({
    resolver: zodResolver(askQuestionSchema),
    defaultValues: { questionText: '' },
  });
  const answerForm = useForm<AnswerValues>({
    resolver: zodResolver(answerQuestionSchema),
    defaultValues: { answerText: '' },
  });

  const submitQuestion = askForm.handleSubmit(async (values) => {
    await onAsk(values.questionText.trim());
    askForm.reset();
  });

  const submitAnswer = (questionId: string) =>
    answerForm.handleSubmit(async (values) => {
      await onAnswer(questionId, values.answerText.trim());
      answerForm.reset();
      setAnswerFor(null);
    });

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[260px]">
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
            posting={posting}
            answerFor={answerFor}
            onStartAnswer={setAnswerFor}
            onCancelAnswer={() => setAnswerFor(null)}
            onSubmitAnswer={submitAnswer}
            onDismiss={onDismiss}
            answerForm={answerForm}
          />
        )}
      </div>

      {canPost && (
        <form onSubmit={submitQuestion} className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            id={`ask-${meetingId}`}
            placeholder="Type your question or message..."
            {...askForm.register('questionText')}
            className="flex-1 text-xs"
          />
          <Button type="submit" size="sm" disabled={posting} className="gap-1 text-xs font-semibold px-3">
            <Send size={13} />
            <span>Send</span>
          </Button>
        </form>
      )}
    </div>
  );
};
