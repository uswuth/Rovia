export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type MeetingJoinMode = 'INVITE_ONLY' | 'OPEN_LINK';
export type MeetingParticipantRole = 'HOST' | 'MODERATOR' | 'MEMBER' | 'VISITOR';
export type MeetingParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT';

/** Per-member capabilities a host can toggle for one participant. */
export interface IMeetingPermissions {
  canSendAudio?: boolean;
  canSendVideo?: boolean;
  canShareScreen?: boolean;
  canUseChat?: boolean;
}

export interface ICreateMeetingInput {
  projectId: string;
  meetingTitle: string;
  meetingDescription?: string;
  meetingScheduledAt: string;
  meetingDurationMinutes?: number;
  meetingJoinMode?: MeetingJoinMode;
  /** May only lower the limit, never raise it above 50. */
  meetingParticipantLimit?: number;
  /** Must all be members or hosts of the project. */
  participantIds?: string[];
}

export interface IMeetingListQuery extends Record<string, unknown> {
  page?: string | number;
  limit?: string | number;
  projectId?: string;
  status?: MeetingStatus;
  search?: string;
  /** Meetings where this user is on the roster. */
  mine?: string;
}
