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

export interface ServiceHealthItem {
  name: string;
  status: string;
  latencyMs: number;
  type: string;
}

export interface SecurityAuditItem {
  id: string;
  event: string;
  status: string;
  sourceIp: string;
  userAgent: string;
  timestamp: string;
}

export interface ServerMetricsData {
  prometheusStatus?: string;
  grafanaStatus?: string;
  activeConnections?: number;
  apiLatencyMs?: number;
  systemMemoryMB?: number;
  heapTotalMB?: number;
  rssMB?: number;
  externalMB?: number;
  nodeVersion?: string;
  platform?: string;
  totalOrganizations?: number;
  totalUsers?: number;
  activeUsers?: number;
  totalMeetings?: number;
  totalTasks?: number;
  totalRecordings?: number;
  weeklyTrends?: WeeklyTrendItem[];
  meetingsByStatus?: MeetingStatusItem[];
  servicesHealth?: ServiceHealthItem[];
  recentSecurityAudits?: SecurityAuditItem[];
}

export interface ServerMetricsResponse {
  uptime?: number;
  timestamp?: string;
  metrics?: ServerMetricsData;
}

export interface AiUsageDailyPoint {
  date: string;
  transcripts: number;
  summaries: number;
  failures: number;
  audioMinutes: number;
}

export interface AiUsageOrganizationRow {
  organizationId: string;
  organizationName: string;
  transcripts: number;
  summaries: number;
  failures: number;
  audioMinutes: number;
}

export interface OpenRouterKeyUsage {
  label: string | null;
  isFreeTier: boolean;
  usageCredits: number | null;
  usageDailyCredits: number | null;
  usageMonthlyCredits: number | null;
  keyLimit: number | null;
  keyLimitRemaining: number | null;
  freeRequestsUsed: number | null;
  freeRequestsLimit: number | null;
  freeRequestsRemaining: number | null;
}

export interface AiUsageData {
  generatedAt: string;
  providers: {
    stt: {
      name: string;
      model: string;
      configured: boolean;
      requestsPerMinute: number;
      requestsPerDay: number;
      audioSecondsPerHour: number;
      audioSecondsPerDay: number;
    };
    summary: {
      name: string;
      model: string;
      fallbackModels: string[];
      configured: boolean;
      requestsPerMinute: number;
      requestsPerDay: number;
    };
    openRouter: OpenRouterKeyUsage | null;
    openRouterChecked: boolean;
  };
  totals: {
    transcripts: number;
    transcriptsReady: number;
    transcriptsFailed: number;
    transcriptsPending: number;
    summaries: number;
    summariesReady: number;
    summariesFailed: number;
    summariesPending: number;
    audioSeconds: number;
    speechMinutes: number;
    inputTokensEstimate: number;
    outputTokensEstimate: number;
    organizationsUsingAi: number;
  };
  today: {
    transcripts: number;
    summaries: number;
    failures: number;
    audioSeconds: number;
    audioMinutes: number;
  };
  quota: {
    stt: {
      usedAudioSeconds: number;
      limitAudioSeconds: number;
      percent: number;
      remainingAudioSeconds: number;
      remainingMinutes: number;
      avgAudioSecondsPerTranscript: number | null;
      estimatedTranscriptsRemaining: number | null;
    };
    summary: {
      usedRequests: number;
      limitRequests: number;
      percent: number;
      remainingRequests: number;
      limitSource: 'openrouter' | 'documented-default';
    };
  };
  daily: AiUsageDailyPoint[];
  byOrganization: AiUsageOrganizationRow[];
  errors: {
    transcriptsFailed: number;
    summariesFailed: number;
    lastTranscriptFailureAt: string | null;
    lastSummaryFailureAt: string | null;
  };
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

export const getAiUsageApi = async () => {
  return await api.get<{ success: boolean; message: string; data: AiUsageData }>('/server-admin/ai-usage');
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