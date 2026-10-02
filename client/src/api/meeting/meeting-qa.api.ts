import client from '../client';

export type MeetingQuestionStatus = 'OPEN' | 'ANSWERED' | 'DISMISSED';

export interface MeetingQuestionAnswer {
  userId: string;
  answerText: string;
  createdAt: string;
}

export interface MeetingQuestion {
  questionId: string;
  questionText: string;
  questionStatus: MeetingQuestionStatus;
  answers: MeetingQuestionAnswer[];
  answerCount: number;
  meetingId: string;
  askedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const getMeetingQuestions = (meetingId: string, status?: string) =>
  client.get<{ data: MeetingQuestion[] }>(`/meetings/${meetingId}/questions`, {
    params: status ? { status } : undefined,
  });

export const askQuestion = (meetingId: string, questionText: string) =>
  client.post<{ data: MeetingQuestion }>(`/meetings/${meetingId}/questions`, { questionText });

export const answerQuestion = (meetingId: string, questionId: string, answerText: string) =>
  client.post<{ data: MeetingQuestion }>(
    `/meetings/${meetingId}/questions/${questionId}/answers`,
    { answerText }
  );

export const dismissQuestion = (meetingId: string, questionId: string) =>
  client.post<{ data: MeetingQuestion }>(
    `/meetings/${meetingId}/questions/${questionId}/dismiss`
  );
