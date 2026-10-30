import { useState, useCallback } from 'react';
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
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { parseApiError } from '@/utils/apiError';

export function useMeetingQaAndPolls({
  meetingId,
  isQaPanelOpen,
  showToast,
}: {
  meetingId: string;
  isQaPanelOpen: boolean;
  showToast: (msg: string) => void;
}) {
  const [qaPending, setQaPending] = useState(false);
  const [pollPending, setPollPending] = useState(false);

  const questions = useQuery<MeetingQuestion[]>(
    queryKeys.meetings.questions(meetingId),
    () => getMeetingQuestions(meetingId),
    { enabled: Boolean(meetingId) && isQaPanelOpen, list: true, refetchInterval: isQaPanelOpen ? 3000 : false }
  );

  const polls = useQuery<MeetingPoll[]>(
    queryKeys.meetings.polls(meetingId),
    () => getMeetingPolls(meetingId),
    { enabled: Boolean(meetingId), list: true }
  );

  const handleAskQuestion = useCallback(async (questionText: string) => {
    setQaPending(true);
    try {
      await askQuestion(meetingId, questionText);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  }, [meetingId, questions, showToast]);

  const handleAnswerQuestion = useCallback(async (questionId: string, answerText: string) => {
    setQaPending(true);
    try {
      await answerQuestion(meetingId, questionId, answerText);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  }, [meetingId, questions, showToast]);

  const handleDismissQuestion = useCallback(async (questionId: string) => {
    setQaPending(true);
    try {
      await dismissQuestion(meetingId, questionId);
      await questions.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setQaPending(false);
    }
  }, [meetingId, questions, showToast]);

  const handleCreatePoll = useCallback(async (pollQuestion: string, options: string[]) => {
    setPollPending(true);
    try {
      await createPoll(meetingId, { pollQuestion, options, multipleChoice: false });
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  }, [meetingId, polls, showToast]);

  const handleVotePoll = useCallback(async (pollId: string, optionIds: string[]) => {
    setPollPending(true);
    try {
      await votePoll(meetingId, pollId, optionIds);
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  }, [meetingId, polls, showToast]);

  const handleClosePoll = useCallback(async (pollId: string) => {
    setPollPending(true);
    try {
      await closePoll(meetingId, pollId);
      await polls.refetch();
    } catch (err) {
      showToast(parseApiError(err).message);
    } finally {
      setPollPending(false);
    }
  }, [meetingId, polls, showToast]);

  return {
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
  };
}
