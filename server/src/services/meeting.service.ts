import {
  Meeting,
  MeetingDocument,
  MeetingParticipantClass,
  MEETING_DEFAULT_PARTICIPANT_LIMIT,
  MEETING_MAX_DURATION_MINUTES
} from '../models/meeting.model.js';
import { Project } from '../models/project.model.js';
import { Team } from '../models/team.model.js';
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

/** Every lookup is tenant scoped; a join code alone never grants access (org comes from the JWT). */
import { Types } from 'mongoose';

/** Tenant scoped lookup: accepts a Mongo ObjectId or a MEET001 join code. */
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

/** Resolves a meeting from its shareable join code; a code from another org resolves to nothing. */
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
const loadProjectRoster = async (
  projectIdOrCode: string,
  organizationId: string
): Promise<{
  roster: Set<string>;
  hosts: Set<string>;
  project: import('../models/project.model.js').ProjectDocument;
}> => {
  const isMongoId = Types.ObjectId.isValid(projectIdOrCode);
  const project = await Project.findOne({
    $or: [
      ...(isMongoId ? [{ _id: projectIdOrCode }] : []),
      { project_code: projectIdOrCode },
      { project_code: projectIdOrCode.toUpperCase() }
    ],
    organization_id: organizationId
  });
  if (!project) {
    throw ApiError.notFound('Project not found');
  }
  return {
    roster: new Set([
      ...project.project_members.map(toObjectIdString),
      ...project.project_hosts.map(toObjectIdString)
    ]),
    hosts: new Set(project.project_hosts.map(toObjectIdString)),
    project
  };
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

  const title = (input.meetingTitle || '').trim();
  validateTitle(title, 'meetingTitle');

  const scheduledAt = new Date(input.meetingScheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw ApiError.badRequest('meetingScheduledAt must be a valid date', [
      { field: 'meetingScheduledAt', message: 'Invalid date' }
    ]);
  }

  const duration = input.meetingDurationMinutes ?? 360;
  if (duration < 1 || duration > MEETING_MAX_DURATION_MINUTES) {
    throw ApiError.badRequest(`meetingDurationMinutes must be between 1 and ${MEETING_MAX_DURATION_MINUTES}`);
  }

  // The limit may only be lowered, never raised above the default.
  const requestedLimit = input.meetingParticipantLimit ?? MEETING_DEFAULT_PARTICIPANT_LIMIT;
  if (requestedLimit < 1 || requestedLimit > MEETING_DEFAULT_PARTICIPANT_LIMIT) {
    throw ApiError.badRequest(
      `meetingParticipantLimit must be between 1 and ${MEETING_DEFAULT_PARTICIPANT_LIMIT}`
    );
  }

  let project: import('../models/project.model.js').ProjectDocument | null = null;
  let roster = new Set<string>();
  let projectHosts = new Set<string>();

  if (input.projectId && input.projectId.trim() && input.projectId !== 'NONE') {
    const loaded = await loadProjectRoster(input.projectId, organizationId);
    roster = loaded.roster;
    projectHosts = loaded.hosts;
    project = loaded.project;
    const projectStatus = (project.project_status || '').toLowerCase();
    if (projectStatus === 'completed' || projectStatus === 'archived') {
      throw ApiError.badRequest(`Cannot schedule meetings for a ${projectStatus} project. Change project status to active first.`);
    }
  }

  let team: import('../models/team.model.js').TeamClass | null = null;
  let teamHosts = new Set<string>();

  if (input.teamId && input.teamId.trim() && input.teamId !== 'NONE') {
    const isMongoId = Types.ObjectId.isValid(input.teamId);
    const foundTeam = await Team.findOne({
      $or: [
        ...(isMongoId ? [{ _id: input.teamId }] : []),
        { team_code: input.teamId },
        { team_code: input.teamId.toUpperCase() }
      ],
      organization_id: organizationId
    });
    if (!foundTeam) {
      throw ApiError.notFound('Team not found');
    }
    team = foundTeam;
    teamHosts = new Set((foundTeam.team_hosts || []).map(toObjectIdString));
  }

  const creator = await User.findById(userId).lean();
  const creatorRole = (creator?.user_role || '').toUpperCase();
  const isSuperOrAdmin = Boolean(
    creator?.is_super_admin === true ||
    creatorRole === 'SUPERADMIN' ||
    creatorRole === 'SUPER_ADMIN' ||
    creatorRole === 'ADMIN'
  );

  if (!isSuperOrAdmin) {
    if (team) {
      const isTeamHost = teamHosts.has(userId);
      const isParentProjectHost = Boolean(project && projectHosts.has(userId));
      if (!isTeamHost && !isParentProjectHost) {
        throw ApiError.forbidden('Only project/team hosts, Admins, or SuperAdmins can create meetings');
      }
    } else if (project) {
      if (!projectHosts.has(userId)) {
        throw ApiError.forbidden('Only project/team hosts, Admins, or SuperAdmins can create meetings');
      }
    } else {
      throw ApiError.forbidden('Only project/team hosts, Admins, or SuperAdmins can create meetings');
    }
  }

  const requested = input.participantIds?.length
    ? await assertUsersInOrganization(input.participantIds, organizationId)
    : [];

  if (project && !isSuperOrAdmin) {
    const outsiders = requested.filter((id) => !roster.has(id));
    if (outsiders.length > 0) {
      throw ApiError.badRequest('Participants must be members or hosts of the selected project', [
        { field: 'participantIds', message: `Not a project member: ${outsiders.join(', ')}` }
      ]);
    }
  }

  const uniqueRoster = [...new Set([userId, ...requested])];
  if (uniqueRoster.length > requestedLimit) {
    throw ApiError.badRequest(
      `This meeting allows ${requestedLimit} participants but ${uniqueRoster.length} were supplied`
    );
  }

  const joinCode = await generateSessionCode(Meeting as unknown as CodeGeneratorModel, organizationId);

  const scope = input.teamId ? 'team' : project ? 'project' : 'general';

  // Creator and top admins are always HOST; requested roles are respected.
  const requestedRoles = input.participantRoles || {};
  const participantsUsers = await User.find({ _id: { $in: uniqueRoster } }).select('user_role is_super_admin').lean();
  const topAdminSet = new Set(
    participantsUsers
      .filter((u) => {
        const role = (u.user_role || '').toUpperCase();
        return u.is_super_admin === true || role === 'SUPERADMIN' || role === 'SUPER_ADMIN' || role === 'ADMIN';
      })
      .map((u) => u._id.toString())
  );

  const meetingParticipants = uniqueRoster.map((id) => {
    let assignedRole: 'HOST' | 'MEMBER' = 'MEMBER';
    if (id === userId || topAdminSet.has(id)) {
      assignedRole = 'HOST';
    } else if (requestedRoles[id]) {
      const normalized = requestedRoles[id].toUpperCase();
      assignedRole = normalized === 'HOST' ? 'HOST' : 'MEMBER';
    }
    return buildParticipant(id, assignedRole);
  });

  const meeting = new Meeting({
    organization_id: organizationId,
    project_id: project ? project._id : undefined,
    team_id: input.teamId && input.teamId !== 'NONE' ? input.teamId : undefined,
    scope,
    created_by: userId,
    meeting_title: title,
    meeting_description: (input.meetingDescription || '').trim(),
    meeting_join_code: joinCode,
    meeting_join_mode: (input.meetingJoinMode ?? 'INVITE_ONLY') as MeetingJoinMode,
    meeting_status: 'SCHEDULED',
    meeting_scheduled_at: scheduledAt,
    meeting_duration_minutes: duration,
    meeting_participant_limit: requestedLimit,
    meeting_participants: meetingParticipants
  });
  await meeting.save();
  return meeting;
};


const findParticipant = (meeting: MeetingDocument, userId: string) =>
  meeting.meeting_participants.find((p) => p.userId === userId);

/** Hosts and moderators may change settings; ordinary members may not. */
const assertCanManageMeeting = (meeting: MeetingDocument, userId: string, userRole?: string): void => {
  const participant = findParticipant(meeting, userId);
  const isCreator = toObjectIdString(meeting.created_by) === userId;
  const isSuperOrAdmin = Boolean(
    userRole && ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(userRole.toUpperCase())
  );
  const pRole = (participant?.participant_role || '').toUpperCase();
  const isManager =
    isCreator || isSuperOrAdmin || pRole === 'HOST' || pRole === 'MODERATOR';
  if (!isManager) {
    throw ApiError.forbidden('Only a meeting host or moderator can do that');
  }
};

/** Shared chat/Q&A/polls checks live here so they are not re-declared per feature. */
/** Loads a meeting and confirms the caller is on its roster. */
export const assertMeetingParticipant = (meeting: MeetingDocument, userId: string): MeetingParticipantClass => {
  let participant = findParticipant(meeting, userId);
  const isCreator = toObjectIdString(meeting.created_by) === userId;
  if (!participant && isCreator) {
    participant = buildParticipant(userId, 'HOST');
    participant.participant_status = 'JOINED';
    participant.joined_at = new Date();
    meeting.meeting_participants.push(participant);
    void meeting.save().catch(() => {});
  } else if (participant && isCreator && participant.participant_role !== 'HOST') {
    participant.participant_role = 'HOST';
    void meeting.save().catch(() => {});
  }
  if (!participant) {
    throw ApiError.forbidden('You are not a participant in this meeting');
  }
  return participant;
};

/** Confirms the caller is a participant AND may chat. */
export const assertMeetingCanChat = (meeting: MeetingDocument, userId: string): void => {
  const participant = assertMeetingParticipant(meeting, userId);
  if (!participant.can_use_chat) {
    throw ApiError.forbidden('Chat is disabled for you in this meeting');
  }
};

/** Confirms the caller is a Host or Moderator before asking questions. */
export const assertMeetingCanAskQuestion = (meeting: MeetingDocument, userId: string): void => {
  const participant = assertMeetingParticipant(meeting, userId);
  if (!participant.can_use_chat) {
    throw ApiError.forbidden('Chat is disabled for you in this meeting');
  }
  const isHostOrMod = participant.participant_role === 'HOST' || participant.participant_role === 'MODERATOR';
  if (!isHostOrMod) {
    throw ApiError.forbidden('Only hosts and moderators can create questions in Q&A');
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
    createdBy: meeting.created_by ? meeting.created_by.toString() : undefined,
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

  // Access is checked across team, project, and org scope, in that order.
  const isCreator = meeting.created_by.toString() === userId;
  let hasScopeAccess = isCreator;

  if (!hasScopeAccess && meeting.team_id) {
    const { Team } = await import('../models/team.model.js');
    const team = await Team.findById(meeting.team_id).lean();
    if (team) {
      const teamMembers = [...(team.team_hosts || []), ...(team.team_members || [])].map((id) => String(id));
      if (teamMembers.includes(userId)) hasScopeAccess = true;
    }
  } else if (!hasScopeAccess && meeting.project_id) {
    const { Project } = await import('../models/project.model.js');
    const project = await Project.findById(meeting.project_id).lean();
    if (project) {
      const projMembers = [
        String(project.created_by || ''),
        ...(project.project_hosts || []).map((id) => String(id)),
        ...(project.project_members || []).map((id) => String(id)),
      ];
      if (projMembers.includes(userId)) hasScopeAccess = true;
    }
  } else if (!hasScopeAccess && !meeting.project_id && !meeting.team_id) {
    // Org-scoped meetings are open to every member of the organization.
    hasScopeAccess = true;
  }

  if (!hasScopeAccess) {
    throw ApiError.forbidden('You do not have access to this meeting.');
  }

  if (meeting.meeting_participants.length >= meeting.meeting_participant_limit) {
    throw ApiError.badRequest('This meeting has reached its participant limit');
  }

  const newPart = buildParticipant(userId, isCreator ? 'HOST' : 'MEMBER');
  newPart.participant_status = 'JOINED';
  newPart.joined_at = new Date();
  meeting.meeting_participants.push(newPart);
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

  const requested = await assertUsersInOrganization(participantIds, organizationId);

  if (meeting.project_id) {
    const { roster } = await loadProjectRoster(toObjectIdString(meeting.project_id), organizationId);
    const outsiders = requested.filter((id) => !roster.has(id));
    if (outsiders.length > 0) {
      throw ApiError.badRequest('Participants must be members or hosts of the meeting project', [
        { field: 'participantIds', message: `Not a project member: ${outsiders.join(', ')}` }
      ]);
    }
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

export const startMeetingService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  userRole?: string
) => {
  requireOrganizationId(organizationId, 'start a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId, userRole);
  if (meeting.meeting_status === 'ENDED' || meeting.meeting_status === 'CANCELLED') {
    throw ApiError.badRequest('This meeting has already finished');
  }
  meeting.meeting_status = 'LIVE';
  meeting.meeting_started_at = new Date();
  await meeting.save();
  return meeting;
};

export const endMeetingService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  userRole?: string
) => {
  requireOrganizationId(organizationId, 'end a meeting');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertCanManageMeeting(meeting, userId, userRole);
  meeting.meeting_status = 'ENDED';
  meeting.meeting_ended_at = new Date();
  await meeting.save();
  return meeting;
};
