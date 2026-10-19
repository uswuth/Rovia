import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  organization: {
    all: ['organization'] as const,
    members: ['organization', 'members'] as const,
  },
  teams: {
    all: ['teams'] as const,
    list: () => ['teams', 'list'] as const,
    detail: (id: string) => ['teams', 'detail', id] as const,
  },
  meetings: {
    all: ['meetings'] as const,
    list: (projectId?: string) => ['meetings', 'list', projectId] as const,
    detail: (id: string) => ['meetings', 'detail', id] as const,
    preview: (code: string) => ['meetings', 'preview', code] as const,
    questions: (meetingId: string) => ['meetings', 'questions', meetingId] as const,
    polls: (meetingId: string) => ['meetings', 'polls', meetingId] as const,
  },
  recordings: {
    all: ['recordings'] as const,
    list: () => ['recordings', 'list'] as const,
    detail: (id: string) => ['recordings', 'detail', id] as const,
    transcript: (id: string) => ['recordings', 'transcript', id] as const,
    summary: (id: string) => ['recordings', 'summary', id] as const,
  },
};

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Auth and project data change on user action, not on a timer; staleTime absorbs duplicate requests.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
        retryDelay: 1000,
      },
      mutations: {
        retry: 0,
      },
    },
  });
