import { api } from '../client';

export interface WorkRoleItem {
  roleId: string;
  roleCode: string;
  roleName: string;
  tagName?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkRolePayload {
  roleName: string;
  tagName?: string;
  description?: string;
  organizationId?: string;
}

export const getWorkRolesApi = async () => {
  return await api.get('/work-roles');
};

export const createWorkRoleApi = async (payload: WorkRolePayload) => {
  return await api.post('/work-roles', payload);
};

export const updateWorkRoleApi = async (roleId: string, payload: Partial<WorkRolePayload>) => {
  return await api.patch(`/work-roles/${roleId}`, payload);
};

export const deleteWorkRoleApi = async (roleId: string) => {
  return await api.delete(`/work-roles/${roleId}`);
};
