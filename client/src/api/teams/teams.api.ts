import { api } from '../client';

export interface TeamUserRef {
  userId: string;
  userName?: string;
  userEmail?: string;
}

export interface TeamItem {
  teamId: string;
  teamName: string;
  teamCode: string;
  description?: string;
  projectId: string | Record<string, unknown>;
  organizationId: string | Record<string, unknown>;
  hosts: (string | TeamUserRef)[];
  members: (string | TeamUserRef)[];
  teamStatus: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface TeamPayload {
  teamName: string;
  description?: string;
  projectId: string;
  hosts?: string[];
  members?: string[];
  teamStatus?: 'active' | 'completed' | 'archived';
}

export const getTeamsApi = async (projectId?: string) => {
  const url = projectId ? `/teams?projectId=${projectId}` : '/teams';
  return await api.get(url);
};

export const createTeamApi = async (payload: TeamPayload) => {
  return await api.post('/teams', payload);
};

export const updateTeamApi = async (teamId: string, payload: Partial<TeamPayload>) => {
  return await api.patch(`/teams/${teamId}`, payload);
};

export const deleteTeamApi = async (teamId: string) => {
  return await api.delete(`/teams/${teamId}`);
};
