import type { BadgeTone } from '@/components/ui/badge-variants';

/** Single source of truth for domain status → badge tone, so no page re-declares the mapping. */
const projectStatusTones: Record<string, BadgeTone> = {
  active: 'success',
  planning: 'warning',
  completed: 'accent',
  archived: 'neutral',
};

export const getProjectStatusTone = (status: string): BadgeTone =>
  projectStatusTones[status.toLowerCase()] ?? 'neutral';

const taskPriorityTones: Record<string, BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export const getTaskPriorityTone = (priority: string): BadgeTone =>
  taskPriorityTones[priority.toLowerCase()] ?? 'neutral';

const taskStatusTones: Record<string, BadgeTone> = {
  done: 'success',
  'in progress': 'warning',
  'to do': 'neutral',
};

export const getTaskStatusTone = (status: string): BadgeTone =>
  taskStatusTones[status.toLowerCase()] ?? 'neutral';

const meetingStatusTones: Record<string, BadgeTone> = {
  live: 'success',
  // Client-derived: meeting is inside its scheduled window but the server has not marked it LIVE.
  in_progress: 'success',
  scheduled: 'info',
  // Mirrors the server's ENDED status.
  ended: 'neutral',
  cancelled: 'danger',
  completed: 'neutral',
};

export const getMeetingStatusTone = (status: string): BadgeTone =>
  meetingStatusTones[status.toLowerCase()] ?? 'neutral';

const meetingJoinModeLabels: Record<string, string> = {
  invite_only: 'Invite only',
  open_link: 'Open link',
};

export const getMeetingJoinModeLabel = (mode: string): string =>
  meetingJoinModeLabels[mode.toLowerCase()] ?? mode;

const questionStatusTones: Record<string, BadgeTone> = {
  open: 'info',
  answered: 'success',
  dismissed: 'neutral',
};

export const getQuestionStatusTone = (status: string): BadgeTone =>
  questionStatusTones[status.toLowerCase()] ?? 'neutral';

const pollStatusTones: Record<string, BadgeTone> = {
  open: 'info',
  closed: 'neutral',
};

export const getPollStatusTone = (status: string): BadgeTone =>
  pollStatusTones[status.toLowerCase()] ?? 'neutral';

const roleTones: Record<string, BadgeTone> = {
  superadmin: 'accent',
  admin: 'info',
  host: 'warning',
  member: 'neutral',
};

export const getRoleBadgeTone = (role: string): BadgeTone =>
  roleTones[role.toLowerCase()] ?? 'neutral';

const userStatusTones: Record<string, BadgeTone> = {
  active: 'success',
  suspended: 'danger',
  deactivated: 'warning',
};

export const getUserStatusTone = (status: string): BadgeTone =>
  userStatusTones[status.toLowerCase()] ?? 'neutral';