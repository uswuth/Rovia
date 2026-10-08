import { api } from '../client';

export type TaskStatusType = 'to_do' | 'in_progress' | 'bug' | 'backlog' | 'completed';

export interface TaskMember {
  userId: string;
  userName?: string;
  userEmail?: string;
}

export interface TaskItem {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  taskStatus: TaskStatusType;
  assignedMembers: (string | TaskMember)[];
  projectId?: string | Record<string, unknown>;
  teamId?: string | Record<string, unknown>;
  organizationId: string;
  createdBy?: string | Record<string, unknown>;
  updatedBy?: string | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  taskTitle: string;
  taskDescription?: string;
  taskStatus?: TaskStatusType;
  assignedMembers?: string[];
  projectId?: string;
  teamId?: string;
}

export const getTasksApi = async (params?: { projectId?: string; teamId?: string; status?: string }) => {
  const query = new URLSearchParams();
  if (params?.projectId) query.append('projectId', params.projectId);
  if (params?.teamId) query.append('teamId', params.teamId);
  if (params?.status) query.append('status', params.status);

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return await api.get(`/tasks${queryString}`);
};

export const getTaskByIdApi = async (taskId: string) => {
  return await api.get(`/tasks/${taskId}`);
};

export const createTaskApi = async (payload: TaskPayload) => {
  return await api.post('/tasks', payload);
};

export const updateTaskApi = async (taskId: string, payload: Partial<TaskPayload>) => {
  return await api.patch(`/tasks/${taskId}`, payload);
};

export const deleteTaskApi = async (taskId: string) => {
  return await api.delete(`/tasks/${taskId}`);
};
