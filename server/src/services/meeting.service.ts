import {
  Meeting,
  MeetingDocument,
  MeetingParticipantClass,
  MEETING_DEFAULT_PARTICIPANT_LIMIT,
  MEETING_MAX_DURATION_MINUTES
} from '../models/meeting.model.js';
import { Project } from '../models/project.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { validateTitle } from '../utils/validation.js';
import { generateSessionCode, CodeGeneratorModel } from '../utils/codeGenerator.js';
import { assertObjectId, toObjectIdString } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { USER_SELECT } from '../utils/projections.js';
import {
  ICreateMeetingInput,
  IMeetingListQuery,
  IMeetingPermissions,
  MeetingJoinMode
} from '../types/index.js';

/**
 * Meeting service. Every lookup is tenant scoped, and a join code alone never
 * grants access: the organization always comes from the authenticated JWT.
 */

import { Types } from 'mongoose';

/** Tenant scoped lookup: supports Mongo ObjectId or MEET001 joinCode. */
export const findScopedMeeting = async (meetingIdOrCode: string, organizationId: string): Promise<MeetingDocument> => {
  const query: Record<string, unknown> = { organization_id: organizationId };
  if (Types.ObjectId.isValid(meetingIdOrCode)) {
    query.$or = [{ _id: meetingIdOrCode }, { meeting_join_code: meetingIdOrCode }];
  } else {
    query.meeting_join_code = meetingIdOrCode;
  }
  const meeting = await Meeting.findOne(query);
  if (!meeting) {
    throw ApiError.notFound('Meeting not found');
  }
  return meeting;
};

/**
 * Resolves a meeting from its shareable join code. Still tenant scoped: a code
 * from another organization resolves to nothing.
 */
export const findScopedMeetingByJoinCode = async (
  joinCode: string,
  organizationId?: string
): Promise<MeetingDocument> => {
  const query: Record<string, unknown> = { meeting_join_code: joinCode };
  if (organizationId) {
    query.organization_id = organizationId;
  }
  const meeting = await Meeting.findOne(query);
  if (!meeting) {
    throw ApiError.notFound('Meeting not found');
  }
  return meeting;
};

/** The project's roster: members and hosts, which is the only assignable set. */
const loadProjectRoster = async (projectId: string, organizationId: string): Promise<Set<string>> => {
  const project = await Project.findOne({ _id: projectId, organization_id: organizationId });
  if (!project) {
    throw ApiError.notFound('Project not found');
  }
  return new Set([
    ...project.project_members.map(toObjectIdString),
    ...project.project_hosts.map(toObjectIdString)
  ]);
};

const assertUsersInOrganization = async (userIds: string[], organizationId: string): Promise<string[]> => {
  const validIds = [...new Set(userIds.map((id) => assertObjectId(id, 'userIds')))];
  const found = await User.find({ _id: { $in: validIds } })
    .select(USER_SELECT)
    .lean();
  const foundIds = new Set(found.map((u) => u._id.toString()));
  const unknown = validIds.filter((id) => !foundIds.has(id));
  if (unknown.length > 0) {
    throw ApiError.badRequest('One or more users do not exist', [
      { field: 'userIds', message: `Unknown userIds: ${unknown.join(', ')}` }
    ]);
  }
  const crossOrg = found.filter((u) => !u.organization_id || u.organization_id.toString() !== organizationId);
  if (crossOrg.length > 0) {
    throw ApiError.badRequest('All participants must belong to the same organization', [
      { field: 'userIds', message: 'Users outside your organization cannot be added' }
    ]);
  }
  return validIds;
};

const buildParticipant = (userId: string, role: 'HOST' | 'MEMBER' = 'MEMBER'): MeetingParticipantClass => {
  const participant = new MeetingParticipantClass();
  participant.userId = userId;
  participant.participant_role = role;
  participant.participant_status = 'INVITED';
  participant.can_send_audio = true;
  participant.can_send_video = true;
  participant.can_share_screen = true;
  participant.can_use_chat = true;
  participant.joined_at = null;
  participant.left_at = null;
  return participant;
};

export const createMeetingService = async (
  input: ICreateMeetingInput,
  organizationId: string,
  userId: string
): Promise<MeetingDocument> => {
  requireOrganizationId(organizationId, 'create a meeting');
  assertObjectId(input.projectId, 'projectId');

  const title = (input.meetingTitle || '').trim();
  validateTitle(title, 'meetingTitle');

  const scheduledAt = new Date(input.meetingScheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw ApiError.badRequest('meetingScheduledAt must be a valid date', [
      { field: 'meetingScheduledAt', message: 'Invalid date' }
    ]);
  }

  const duration = input.meetingDurationMinutes ?? 30;
  if (duration < 1 || duration > MEETING_MAX_DURATION_MINUTES) {
    throw ApiError.badRequest(`meetingDurationMinutes must be between 1 and ${MEETING_MAX_DURATION_MINUTES}`);
  }

  // The limit may only be lowered. Raising it above the default is never allowed.
  const requestedLimit = input.meetingParticipantLimit ?? MEETING_DEFAULT_PARTICIPANT_LIMIT;
  if (requestedLimit < 1 || requestedLimit > MEETING_DEFAULT_PARTICIPANT_LIMIT) {
    throw ApiError.badRequest(
      `meetingParticipantLimit must be between 1 and ${MEETING_DEFAULT_PARTICIPANT_LIMIT}`
    );
  }

  const roster = await loadProjectRoster(input.projectId, organizationId);
  const project = await Project.findOne({ _id: input.projectId, organization_id: organizationId });
  if (project) {
    const projectStatus = (project.project_status || '').toLowerCase();
    if (projectStatus === 'completed' || projectStatus === 'archived') {
      throw ApiError.badRequest(`Cannot schedule meetings for a ${projectStatus} project. Change project status to active first.`);
    }
  }
  const creator = await User.findById(userId).lean();
  const isSuperAdmin = creator?.user_role === 'SuperAdmin' || creator?.is_super_admin === true;

  // The creator must belong to the project as a member/host, unless they are a SuperAdmin.
  if (!isSuperAdmin && !roster.has(userId)) {
    throw ApiError.forbidden('Only project members or hosts can create a meeting for this project');
  }

  const requested = input.participantIds?.length
    ? await assertUsersInOrganization(input.participantIds, organizationId)
    : [];
  const outsiders = requested.filter((id) => !roster.has(id));
  if (!isSuperAdmin && outsiders.length > 0) {
    // An organization invite code does not bypass this for ordinary members.
    throw ApiError.badRequest('Participants must be members or hosts of the selected project', [
      { field: 'participantIds', message: `Not a project member: ${outsiders.join(', ')}` }
    ]);
  }

  const uniqueRoster = [...new Set([userId, ...requested])];
  if (uniqueRoster.length > requestedLimit) {
    throw ApiError.badRequest(
      `This meeting allows ${requestedLimit} participants but ${uniqueRoster.length} were supplied`
    );
  }

  const joinCode = await generateSessionCode(Meeting as unknown as CodeGeneratorModel, organizationId);

  const meeting = new Meeting({
    organization_id: organizationId,
    project_id: input.projectId,
    created_by: userId,
    meeting_title: title,
    meeting_description: (input.meetingDescription || '').trim(),
    meeting_join_code: joinCode,
    meeting_join_mode: (input.meetingJoinMode ?? 'INVITE_ONLY') as MeetingJoinMode,
    meeting_status: 'SCHEDULED',
    meeting_scheduled_at: scheduledAt,
    meeting_duration_minutes: duration,
    meeting_participant_limit: requestedLimit,
    meeting_participants: uniqueRoster.map((id) => buildParticipant(id, id === userId ? 'HOST' : 'MEMBER'))
  });
  await meeting.save();
  return meeting;
};


const findParticipant = (meeting: MeetingDocument, userId: string) =>
  meeting.meeting_participants.find((p) => p.userId === userId);

/** Hosts and moderators may change settings; ordinary members may not. */
const assertCanManageMeeting = (meeting: MeetingDocument, userId: string): void => {
  const participant = findParticipant(meeting, userId);
  const isCreator = toObjectIdString(meeting.created_by) === userId;
  const isManager =
    isCreator || participant?.participant_role === 'HOST' || participant?.participant_role === 'MODERATOR';
  if (!isManager) {
    throw ApiError.forbidden('Only a meeting host or moderator can do that');
  }
};

/**
 * Every in-meeting feature (chat, Q&A, polls) needs the same two checks, so
 * they live here rather than being re-declared per feature.
 */

/** Loads a meeting and confirms the caller is on its roster. */
export const assertMeetingParticipant = (meeting: MeetingDocument, userId: string): MeetingParticipantClass => {
  const participant = findParticipant(meeting, userId);
  if (!participant) {
    throw ApiError.forbidden('You are not a participant in this meeting');
  }
  return participant;
};

/** Loads a meeting and confirms the caller is on its roster AND may chat. */
export const assertMeetingCanChat = (meeting: MeetingDocument, userId: string): void => {
  const participant = assertMeetingParticipant(meeting, userId);
  if (!participant.can_use_chat) {
    throw ApiError.forbidden('Chat is disabled for you in this meeting');
  }
};

export const getMeetingsService = async (organizationId: string, query: IMeetingListQuery) => {
  requireOrganizationId(organizationId, 'list meetings');
  const filter: Record<string, unknown> = { organization_id: organizationId };
  if (query.projectId) filter.project_id = assertObjectId(query.projectId, 'projectId');
  if (query.status) filter.meeting_status = query.status;
  if (query.mine === 'true' && query.userId) filter['meeting_participants.userId'] = query.userId;
  if (query.search && typeof query.search === 'string' && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { meeting_title: searchRegex },
      { meeting_description: searchRegex },
      { meeting_join_code: searchRegex }
    ];
  }
  return findPaginated(Meeting, filter, query, { sort: { created_at: -1, _id: -1 } });
};

export const getMeetingByIdService = async (meetingId: string, organizationId: string) => {
  requireOrganizationId(organizationId, 'view a meeting');
  assertObjectId(meetingId, 'meetingId');
  return findScopedMeeting(meetingId, organizationId);
};

/** Public preview from the link, shown before joining. */
export const previewMeetingByJoinCodeService = async (joinCode: string, organizationId?: string) => {
  if (organizationId) {
    requireOrganizationId(organizationId, 'view a meeting');
  }
  const meeting = await findScopedMeetingByJoinCode(joinCode, organizationId);
  return {
    meetingId: meeting.meetingId,
    meetingTitle: meeting.meeting_title,
    meetingDescription: meeting.meeting_description || '',
    meetingStatus: meeting.meeting_status,
    meetingScheduledAt: meeting.meeting_scheduled_at,
    meetingDurationMinutes: meeting.meeting_duration_minutes,
    meetingJoinMode: meeting.meeting_join_mode,
    meetingParticipantCount: meeting.meeting_participants.length,
    meetingParticipantLimit: meeting.meeting_participant_limit,
    meetingJoinCode: meeting.meeting_join_code,
    participants: (meeting.meeting_participants || []).map((p) => ({
      userId: p.userId,
      participantRole: p.participant_role,
      participantStatus: p.participant_status,
      canSendAudio: p.can_send_audio,
      canSendVideo: p.can_send_video,
      canShareScreen: p.can_share_screen,
      canUseChat: p.can_use_chat,
      joinedAt: p.joined_at,
      leftAt: p.left_at
    }))
  };
};

/**
 * Join rules, in order:
 *   1. authenticated (route level)
 *   2. same organization (tenant scoped, so another org gets 404)
 *   3. meeting not already over
 *   4. INVITE_ONLY -> must already be on the roster
 *   5. capacity
 */
export const joinMeetingService = async (
  meetingId: string,
  organizationId: string,
  userId: string
): Promise<MeetingDocument> => {
  requireOrganizationId(organizationId, 'join a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);

  if (meeting.meeting_status === 'ENDED' || meeting.meeting_status === 'CANCELLED') {
    throw ApiError.badRequest('This meeting has already finished');
  }

  const existing = findParticipant(meeting, userId);
  if (existing) {
    existing.participant_status = 'JOINED';
    existing.joined_at = new Date();
    existing.left_at = null;
    await meeting.save();
    return meeting;
  }

  if (meeting.meeting_join_mode === 'INVITE_ONLY') {
    throw ApiError.forbidden('This meeting is invite only. Ask a host to add you.');
  }

  if (meeting.meeting_participants.length >= meeting.meeting_participant_limit) {
    throw ApiError.badRequest('This meeting has reached its participant limit');
  }

  meeting.meeting_participants.push(buildParticipant(userId));
  await meeting.save();
  return meeting;
};


export const leaveMeetingService = async (
  meetingId: string,
  organizationId: string,
  userId: string
): Promise<MeetingDocument> => {
  requireOrganizationId(organizationId, 'leave a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  const participant = findParticipant(meeting, userId);
  if (!participant) {
    throw ApiError.notFound('You are not a participant in this meeting');
  }
  participant.participant_status = 'LEFT';
  participant.left_at = new Date();
  await meeting.save();
  return meeting;
};

export const addMeetingParticipantsService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  participantIds: string[]
) => {
  requireOrganizationId(organizationId, 'manage meeting participants');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId);

  const roster = await loadProjectRoster(toObjectIdString(meeting.project_id), organizationId);
  const requested = await assertUsersInOrganization(participantIds, organizationId);
  const outsiders = requested.filter((id) => !roster.has(id));
  if (outsiders.length > 0) {
    throw ApiError.badRequest('Participants must be members or hosts of the meeting project', [
      { field: 'participantIds', message: `Not a project member: ${outsiders.join(', ')}` }
    ]);
  }

  const existing = new Set(meeting.meeting_participants.map((p) => p.userId));
  const toAdd = requested.filter((id) => !existing.has(id));
  if (meeting.meeting_participants.length + toAdd.length > meeting.meeting_participant_limit) {
    throw ApiError.badRequest(
      `Adding ${toAdd.length} would exceed the participant limit of ${meeting.meeting_participant_limit}`
    );
  }

  meeting.meeting_participants.push(...toAdd.map((id) => buildParticipant(id)));
  await meeting.save();
  return meeting;
};

/** Per-member capability toggles: mic, camera, screen share, chat. */
export const updateMeetingParticipantSettingsService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  participantId: string,
  permissions: IMeetingPermissions
) => {
  requireOrganizationId(organizationId, 'manage meeting settings');
  assertObjectId(meetingId, 'meetingId');
  assertObjectId(participantId, 'participantId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId);

  const participant = findParticipant(meeting, participantId);
  if (!participant) {
    throw ApiError.notFound('That user is not a participant in this meeting');
  }

  if (permissions.canSendAudio !== undefined) participant.can_send_audio = permissions.canSendAudio;
  if (permissions.canSendVideo !== undefined) participant.can_send_video = permissions.canSendVideo;
  if (permissions.canShareScreen !== undefined) participant.can_share_screen = permissions.canShareScreen;
  if (permissions.canUseChat !== undefined) participant.can_use_chat = permissions.canUseChat;

  await meeting.save();
  return meeting;
};

export const startMeetingService = async (meetingId: string, organizationId: string, userId: string) => {
  requireOrganizationId(organizationId, 'start a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId);
  if (meeting.meeting_status === 'ENDED' || meeting.meeting_status === 'CANCELLED') {
    throw ApiError.badRequest('This meeting has already finished');
  }
  meeting.meeting_status = 'LIVE';
  meeting.meeting_started_at = new Date();
  await meeting.save();
  return meeting;
};

export const endMeetingService = async (meetingId: string, organizationId: string, userId: string) => {
  requireOrganizationId(organizationId, 'end a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId);
  meeting.meeting_status = 'ENDED';
  meeting.meeting_ended_at = new Date();
  await meeting.save();
  return meeting;
};
