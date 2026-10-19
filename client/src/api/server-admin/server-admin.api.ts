import { api } from '../client';

// Server Admin payload types (mirrors server src/routes/server-admin.routes.ts)
export interface ServerAdminLoginPayload {
  username: string;
  password: string;
}

export interface CreateOrgWithCredentialsPayload {
  organizationName: string;
  organizationLocation?: string;
  organizationDescription?: string;
  adminName?: string;
  adminEmail: string;
}

export interface WeeklyTrendItem {
  week: string;
  meetings: number;
  attendees: number;
  tasksCompleted: number;
  avgDurationMin: number;
  productivityScore: number;
}

export interface MeetingStatusItem {
  status: string;
  count: number;
}

export interface ServerMetricsData {
  prometheusStatus?: string;
  grafanaStatus?: string;
  activeConnections?: number;
  apiLatencyMs?: number;
  systemMemoryMB?: number;
  totalOrganizations?: number;
  totalUsers?: number;
  activeUsers?: number;
  totalMeetings?: number;
  totalTasks?: number;
  totalRecordings?: number;
  weeklyTrends?: WeeklyTrendItem[];
  meetingsByStatus?: MeetingStatusItem[];
}

export interface ServerMetricsResponse {
  uptime?: number;
  timestamp?: string;
  metrics?: ServerMetricsData;
}

// Server Admin Login - uses v1 API version
// All endpoints use /api/v1/server-admin/...
export const loginServerAdminApi = async (payload: ServerAdminLoginPayload) => {
  return await api.post('/server-admin/login', payload);
};

// v1: Public-facing endpoints (no special auth beyond bearerAuth)
export const getServerMetricsApi = async () => {
  return await api.get('/server-admin/metrics');
};

export const getAllOrganizationsServerAdminApi = async () => {
  return await api.get('/server-admin/organizations');
};

export const getOrgDetailsServerAdminApi = async (orgId: string) => {
  return await api.get(`/server-admin/organizations/${orgId}`);
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

// v1: Public-facing endpoints (same as above, for consistency)
export const getServerMetricsV1Api = async () => {
  return await api.post('/server-admin/metrics', {});
};

export const getAllOrganizationsV1Api = async () => {
  return await api.post('/server-admin/organizations', {});
};