import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { getRequestScope } from '../utils/scope.js';
import {
  createMeetingService,
  getMeetingsService,
  getMeetingByIdService,
  previewMeetingByJoinCodeService,
  joinMeetingService,
  leaveMeetingService,
  addMeetingParticipantsService,
  updateMeetingParticipantSettingsService,
  startMeetingService,
  endMeetingService
} from '../services/meeting.service.js';
import {
  ICreateMeetingInput,
  IMeetingListQuery,
  IMeetingPermissions,
  MeetingJoinMode,
  MeetingStatus
} from '../types/index.js';

const JOIN_MODES: MeetingJoinMode[] = ['INVITE_ONLY', 'OPEN_LINK'];
const MEETING_STATUSES: MeetingStatus[] = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'];

export const createMeeting = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const input = req.body as ICreateMeetingInput;

  if (input.meetingJoinMode && !JOIN_MODES.includes(input.meetingJoinMode)) {
    throw ApiError.badRequest('meetingJoinMode must be INVITE_ONLY or OPEN_LINK');
  }

  const meeting = await createMeetingService(input, organizationId, userId);
  return ApiResponse.success(res, 'Meeting created successfully', meeting, 201);
};

export const getMeetings = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const query = { ...(req.query as unknown as IMeetingListQuery), userId };

  if (query.status && !MEETING_STATUSES.includes(query.status)) {
    throw ApiError.badRequest('status must be one of SCHEDULED, LIVE, ENDED, CANCELLED');
  }

  const meetings = await getMeetingsService(organizationId, query);
  return ApiResponse.success(res, 'Meetings retrieved successfully', meetings, 200);
};

export const getMeetingById = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const meeting = await getMeetingByIdService(req.params.id, organizationId);
  return ApiResponse.success(res, 'Meeting retrieved successfully', meeting, 200);
};

export const previewMeetingByJoinCode = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const preview = await previewMeetingByJoinCodeService(req.params.code, organizationId);
  return ApiResponse.success(res, 'Meeting preview retrieved successfully', preview, 200);
};

export const joinMeeting = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const meeting = await joinMeetingService(req.params.id, organizationId, userId);
  return ApiResponse.success(res, 'Joined meeting successfully', meeting, 200);
};

export const leaveMeeting = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const meeting = await leaveMeetingService(req.params.id, organizationId, userId);
  return ApiResponse.success(res, 'Left meeting successfully', meeting, 200);
};

export const addMeetingParticipants = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { participantIds } = req.body as { participantIds?: string[] };

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw ApiError.badRequest('participantIds must be a non-empty array');
  }

  const meeting = await addMeetingParticipantsService(
    req.params.id,
    organizationId,
    userId,
    participantIds
  );
  return ApiResponse.success(res, 'Participants added successfully', meeting, 200);
};

export const updateMeetingParticipantSettings = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { participantId, ...permissions } = req.body as IMeetingPermissions & { participantId?: string };

  if (!participantId) {
    throw ApiError.badRequest('participantId is required');
  }

  const meeting = await updateMeetingParticipantSettingsService(
    req.params.id,
    organizationId,
    userId,
    participantId,
    permissions
  );
  return ApiResponse.success(res, 'Participant settings updated successfully', meeting, 200);
};

export const startMeeting = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const meeting = await startMeetingService(req.params.id, organizationId, userId);
  return ApiResponse.success(res, 'Meeting started successfully', meeting, 200);
};

export const endMeeting = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const meeting = await endMeetingService(req.params.id, organizationId, userId);
  return ApiResponse.success(res, 'Meeting ended successfully', meeting, 200);
};
