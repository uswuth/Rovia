/** Mirrors the server `toJSON` shape. Optional where the server may omit it. */

export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type MeetingJoinMode = 'INVITE_ONLY' | 'OPEN_LINK';
export type MeetingParticipantRole = 'HOST' | 'MODERATOR' | 'MEMBER' | 'VISITOR';
export type MeetingParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT';

export interface MeetingParticipant {
  userId: string;
  participantRole: MeetingParticipantRole;
  participantStatus: MeetingParticipantStatus;
  canSendAudio: boolean;
  canSendVideo: boolean;
  canShareScreen: boolean;
  canUseChat: boolean;
  joinedAt?: string | null;
  leftAt?: string | null;
}

export interface Meeting {
  meetingId: string;
  meetingTitle: string;
  meetingDescription?: string;
  meetingStatus: MeetingStatus;
  meetingJoinMode: MeetingJoinMode;
  meetingScheduledAt: string;
  meetingDurationMinutes: number;
  meetingParticipantLimit: number;
  meetingJoinCode: string;
  organizationId: string;
  projectId: string;
  createdBy: string;
  createdAt?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  participants: MeetingParticipant[];
}

/** The link preview returned by GET /meetings/join/:code. */
export interface MeetingPreview {
  meetingId: string;
  meetingTitle: string;
  meetingDescription?: string;
  meetingStatus: MeetingStatus;
  meetingScheduledAt: string;
  meetingDurationMinutes: number;
  meetingJoinMode: MeetingJoinMode;
  meetingParticipantCount: number;
  meetingParticipantLimit: number;
  meetingJoinCode?: string;
  participants?: MeetingParticipant[];
}

export interface CreateMeetingDTO {
  projectId: string;
  meetingTitle: string;
  meetingDescription?: string;
  /** ISO string. The API requires a real date; the form normalises to this. */
  meetingScheduledAt: string;
  meetingDurationMinutes?: number;
  meetingJoinMode?: MeetingJoinMode;
  meetingParticipantLimit?: number;
  participantIds?: string[];
}

export interface ParticipantPermissions {
  canSendAudio?: boolean;
  canSendVideo?: boolean;
  canShareScreen?: boolean;
  canUseChat?: boolean;
}
