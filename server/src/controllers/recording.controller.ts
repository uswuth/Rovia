import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { getRequestScope } from '../utils/scope.js';
import {
  createRecordingService,
  getRecordingsService,
  getRecordingByIdService,
  getRecordingUploadUrlService,
  completeRecordingService,
  getRecordingDownloadUrlService,
  deleteRecordingService
} from '../services/recording.service.js';
import { getTranscriptByRecordingService, getTranscriptStatusService } from '../services/transcript.service.js';
import { getSummaryByRecordingService, getSummaryStatusService } from '../services/summary.service.js';
import { ICreateRecordingInput, IRecordingListQuery, RecordingStatus } from '../types/index.js';

const RECORDING_STATUSES: RecordingStatus[] = ['PENDING', 'READY', 'FAILED', 'DELETED'];

export const createRecording = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const input = req.body as ICreateRecordingInput;

  const recording = await createRecordingService(input, organizationId, userId);

  return ApiResponse.success(res, 'Recording created successfully', recording, 201);
};

export const getRecordings = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const query = req.query as unknown as IRecordingListQuery;

  if (query.status && !RECORDING_STATUSES.includes(query.status)) {
    throw ApiError.badRequest('status must be one of PENDING, READY, FAILED, DELETED');
  }

  const recordings = await getRecordingsService(organizationId, query);

  return ApiResponse.success(res, 'Recordings retrieved successfully', recordings, 200);
};

export const getRecordingById = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;

  const recording = await getRecordingByIdService(id, organizationId);

  // Processing state is a separate concern from the recording's own status, and
  // is reported alongside it rather than folded into recording_status.
  const [transcriptionStatus, summaryStatus] = await Promise.all([
    getTranscriptStatusService(id, organizationId),
    getSummaryStatusService(id, organizationId)
  ]);

  return ApiResponse.success(
    res,
    'Recording retrieved successfully',
    {
      ...(recording.toJSON() as Record<string, unknown>),
      transcriptionStatus: transcriptionStatus ?? 'PENDING',
      summaryStatus: summaryStatus ?? 'PENDING'
    },
    200
  );
};

export const getRecordingTranscript = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;

  const transcript = await getTranscriptByRecordingService(id, organizationId);

  return ApiResponse.success(res, 'Transcript retrieved successfully', transcript, 200);
};

export const getRecordingSummary = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;

  const summary = await getSummaryByRecordingService(id, organizationId);

  return ApiResponse.success(res, 'Summary retrieved successfully', summary, 200);
};

export const getRecordingUploadUrl = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;

  const result = await getRecordingUploadUrlService(id, organizationId);

  return ApiResponse.success(res, 'Upload URL generated successfully', result, 200);
};

export const completeRecording = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { id } = req.params;
  const { durationMs } = req.body as { durationMs?: number };

  if (durationMs !== undefined && (typeof durationMs !== 'number' || !Number.isFinite(durationMs))) {
    throw ApiError.badRequest('durationMs must be a number');
  }

  const recording = await completeRecordingService(id, organizationId, durationMs ?? 0, userId);

  return ApiResponse.success(res, 'Recording completed successfully', recording, 200);
};

export const getRecordingDownloadUrl = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;

  const result = await getRecordingDownloadUrlService(id, organizationId);

  return ApiResponse.success(res, 'Download URL generated successfully', result, 200);
};

export const deleteRecording = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { id } = req.params;

  await deleteRecordingService(id, organizationId, userId);

  return ApiResponse.success(res, 'Recording deleted successfully', null, 200);
};
