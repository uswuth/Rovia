import { api } from '../client';

export interface ServerAdminLoginPayload {
  username: string;
  password: string;
}

export interface CreateOrgWithCredentialsPayload {
  organizationName: string;
  organizationLocation?: string;
  organizationDescription?: string;
  adminName: string;
  adminEmail: string;
}

export const loginServerAdminApi = async (payload: ServerAdminLoginPayload) => {
  return await api.post('/server-admin/login', payload);
};

export const getServerMetricsApi = async () => {
  return await api.get('/server-admin/metrics');
};

export const getAllOrganizationsServerAdminApi = async () => {
  return await api.get('/server-admin/organizations');
};

export const createOrgWithCredentialsApi = async (payload: CreateOrgWithCredentialsPayload) => {
  return await api.post('/server-admin/organizations', payload);
};

export const updateOrgServerAdminApi = async (orgId: string, payload: Partial<CreateOrgWithCredentialsPayload>) => {
  return await api.patch(`/server-admin/organizations/${orgId}`, payload);
};

export const deleteOrgServerAdminApi = async (orgId: string) => {
  return await api.delete(`/server-admin/organizations/${orgId}`);
};
