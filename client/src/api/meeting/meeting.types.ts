/** Mirrors the server `toJSON` shape. Optional where the server may omit it. */

/** Raw participant as the server actually sends it: `userId` is camelCase
 *  but role/status/permission flags arrive in `snake_case` (see the Network
 *  tab on GET /meetings/:id). Both spellings are accepted so the room never
 *  drops a profile it cannot parse. */
export interface MeetingParticipantRaw {
  userId?: string;
  user_id?: string;
  participantRole?: MeetingParticipantRole;
  participant_role?: MeetingParticipantRole;
  participantStatus?: MeetingParticipantStatus;
  participant_status?: MeetingParticipantStatus;
  canSendAudio?: boolean;
  can_send_audio?: boolean;
  canSendVideo?: boolean;
  can_send_video?: boolean;
  canShareScreen?: boolean;
  can_share_screen?: boolean;
  canUseChat?: boolean;
  can_use_chat?: boolean;
  joinedAt?: string | null;
  joined_at?: string | null;
  leftAt?: string | null;
  left_at?: string | null;
}

export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type MeetingJoinMode = 'INVITE_ONLY';
export type MeetingParticipantRole = 'HOST' | 'MODERATOR' | 'MEMBER';
export type MeetingParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT';

export interface MeetingParticipant {
  userId: string;
  userName?: string;
  avatarUrl?: string;
  participantRole: MeetingParticipantRole;
  participantStatus: MeetingParticipantStatus;
  canSendAudio: boolean;
  canSendVideo: boolean;
  canShareScreen: boolean;
  canUseChat: boolean;
  joinedAt?: string | null;
  leftAt?: string | null;
}

/** Accepts either spelling the server may send and returns the camelCase form
 *  the room renders. Safely unwraps populated Mongoose objects so userId is
 *  always a valid string ID. */
export const normalizeParticipant = (raw: MeetingParticipantRaw): MeetingParticipant => {
  const pick = <T,>(camel: T | undefined, snake: T | undefined, fallback: T): T =>
    camel ?? snake ?? fallback;

  const rawAny = raw as unknown as Record<string, unknown>;
  const userObj =
    typeof raw.userId === 'object' && raw.userId !== null
      ? (raw.userId as unknown as Record<string, unknown>)
      : typeof rawAny.user === 'object' && rawAny.user !== null
      ? (rawAny.user as unknown as Record<string, unknown>)
      : null;

  const idStr = userObj
    ? String(userObj._id || userObj.userId || userObj.id || '')
    : String(raw.userId ?? raw.user_id ?? rawAny.id ?? '');

  const userName = userObj
    ? String(userObj.userName || userObj.name || userObj.userEmail || '')
    : String(rawAny.userName || rawAny.name || '');

  const avatarUrl = userObj
    ? String(userObj.avatarUrl || userObj.avatar || '')
    : String(rawAny.avatarUrl || rawAny.avatar || '');

  return {
    userId: idStr,
    userName: userName || undefined,
    avatarUrl: avatarUrl || undefined,
    participantRole: pick(raw.participantRole, raw.participant_role, 'MEMBER'),
    participantStatus: pick(raw.participantStatus, raw.participant_status, 'INVITED'),
    canSendAudio: pick(raw.canSendAudio, raw.can_send_audio, true),
    canSendVideo: pick(raw.canSendVideo, raw.can_send_video, true),
    canShareScreen: pick(raw.canShareScreen, raw.can_share_screen, true),
    canUseChat: pick(raw.canUseChat, raw.can_use_chat, true),
    joinedAt: raw.joinedAt ?? raw.joined_at ?? null,
    leftAt: raw.leftAt ?? raw.left_at ?? null,
  };
};

export const normalizeParticipants = (raw: MeetingParticipantRaw[] = []): MeetingParticipant[] =>
  raw.map(normalizeParticipant);

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
  teamId?: string;
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
  createdBy?: string;
  participants?: MeetingParticipant[];
}

export interface CreateMeetingDTO {
  projectId: string;
  teamId?: string;
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
