import client from '../client';

export type MeetingPollStatus = 'OPEN' | 'CLOSED';

/** The server exposes counts only. Voter identities are never returned. */
export interface MeetingPollOption {
  optionId: string;
  optionText: string;
  voteCount: number;
}

export interface MeetingPoll {
  pollId: string;
  pollQuestion: string;
  pollStatus: MeetingPollStatus;
  pollMultipleChoice: boolean;
  pollOptions: MeetingPollOption[];
  meetingId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const getMeetingPolls = (meetingId: string, status?: string) =>
  client.get<{ data: MeetingPoll[] }>(`/meetings/${meetingId}/polls`, {
    params: status ? { status } : undefined,
  });

export const createPoll = (
  meetingId: string,
  payload: { pollQuestion: string; options: string[]; multipleChoice: boolean }
) => client.post<{ data: MeetingPoll }>(`/meetings/${meetingId}/polls`, payload);

export const votePoll = (meetingId: string, pollId: string, optionIds: string[]) =>
  client.post<{ data: MeetingPoll }>(`/meetings/${meetingId}/polls/${pollId}/vote`, { optionIds });

export const closePoll = (meetingId: string, pollId: string) =>
  client.post<{ data: MeetingPoll }>(`/meetings/${meetingId}/polls/${pollId}/close`);
