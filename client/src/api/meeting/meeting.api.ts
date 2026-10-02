import client from '../client';
import type {
  Meeting,
  MeetingPreview,
  CreateMeetingDTO,
  ParticipantPermissions,
} from './meeting.types';

export const getMeetings = (params?: { projectId?: string; status?: string; mine?: boolean }) =>
  client.get<{ data: Meeting[] }>('/meetings', { params });

export const getMeetingById = (id: string) => client.get<{ data: Meeting }>(`/meetings/${id}`);

export const previewMeetingByJoinCode = (code: string) =>
  client.get<{ data: MeetingPreview }>(`/meetings/join/${code}`);

export const createMeeting = (data: CreateMeetingDTO) => client.post<{ data: Meeting }>('/meetings', data);

export const joinMeeting = (id: string) => client.post<{ data: Meeting }>(`/meetings/${id}/join`);

export const leaveMeeting = (id: string) => client.post<{ data: Meeting }>(`/meetings/${id}/leave`);

export const addMeetingParticipants = (id: string, participantIds: string[]) =>
  client.post<{ data: Meeting }>(`/meetings/${id}/participants`, { participantIds });

export const updateParticipantSettings = (
  id: string,
  participantId: string,
  permissions: ParticipantPermissions
) =>
  client.post<{ data: Meeting }>(`/meetings/${id}/participant-settings`, {
    participantId,
    ...permissions,
  });

export const startMeeting = (id: string) => client.post<{ data: Meeting }>(`/meetings/${id}/start`);

export const endMeeting = (id: string) => client.post<{ data: Meeting }>(`/meetings/${id}/end`);
