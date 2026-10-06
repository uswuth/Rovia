import type { BadgeTone } from '@/components/ui/badge-variants';

/**
 * Maps a domain status string to a badge tone. Keeps status→color mapping in
 * one place so a page never re-declares a switch statement for it.
 */
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
  // Client-side display state for a meeting inside its scheduled window but not
  // yet marked LIVE by the server.
  in_progress: 'success',
  scheduled: 'info',
  // The server uses ENDED/CANCELLED; both read as neutral, non-actionable.
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

/** Display label for a join mode, used wherever the mode is shown as text. */
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