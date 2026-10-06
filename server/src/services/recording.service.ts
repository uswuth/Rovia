import { Types } from 'mongoose';
import { Recording, RecordingDocument } from '../models/recording.model.js';
import { Project } from '../models/project.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { assertObjectId, toObjectIdString } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { USER_SELECT } from '../utils/projections.js';
import {
  MAX_PENDING_RECORDINGS_PER_ORG,
  MAX_RECORDING_DURATION_MS,
  MAX_RECORDING_SIZE_BYTES,
  UPLOAD_URL_TTL_SECONDS,
  DOWNLOAD_URL_TTL_SECONDS,
  buildRecordingStorageKey,
  isAllowedRecordingMimeType,
  recordingExpiresAt
} from '../utils/recording.js';
import { createUploadUrl, createDownloadUrl, headObject, deleteObject } from './storage.service.js';
import { recordingPostProcessingService } from './recording-post-processing.service.js';
import { ICreateRecordingInput, IRecordingListQuery } from '../types/index.js';

const RECORDING_POPULATE = [
  { path: 'created_by', select: USER_SELECT }
];

/**
 * Every recording lookup is tenant-scoped: an id alone never grants access.
 * Recording.findById(id) must never appear in this file.
 */
const findScopedRecording = async (recordingId: string, organizationId: string): Promise<RecordingDocument> => {
  const recording = await Recording.findOne({ _id: recordingId, organization_id: organizationId });
  if (!recording) {
    throw ApiError.notFound('Recording not found');
  }
  return recording;
};

const findPopulatedRecording = async (recordingId: string): Promise<RecordingDocument | null> =>
  Recording.findById(recordingId).populate(RECORDING_POPULATE);

export const createRecordingService = async (
  input: ICreateRecordingInput,
  organizationId: string,
  userId: string
): Promise<RecordingDocument> => {
  requireOrganizationId(organizationId, 'create a recording');

  const declaredType = (input.contentType ?? '').trim();
  if (!isAllowedRecordingMimeType(declaredType)) {
    throw ApiError.badRequest('contentType is not an allowed recording type', [
      { field: 'contentType', message: `Unsupported content type: ${declaredType}` }
    ]);
  }

  if (input.projectId) {
    assertObjectId(input.projectId, 'projectId');
    const project = await Project.findOne({ _id: input.projectId, organization_id: organizationId });
    if (!project) {
      throw ApiError.notFound('Project not found');
    }
  }

  if (input.meetingId) {
    // Opaque only: validated as an id, never resolved, because no Meeting
    // collection exists yet.
    assertObjectId(input.meetingId, 'meetingId');
  }

  const pendingCount = await Recording.countDocuments({ organization_id: organizationId, recording_status: 'PENDING' });
  if (pendingCount >= MAX_PENDING_RECORDINGS_PER_ORG) {
    throw ApiError.badRequest('Too many recordings awaiting upload. Complete or discard the pending ones first.');
  }

  // The storage key embeds this document's id, and storage_key is required, so
  // the id is generated up front and assigned to the document. The key and the
  // _id therefore always agree.
  const recordingId = new Types.ObjectId();
  const recording = new Recording({
    _id: recordingId,
    organization_id: organizationId,
    created_by: userId,
    // Placeholder until complete() reads the authoritative value from HeadObject.
    recording_mime_type: declaredType,
    recording_status: 'PENDING',
    project_id: input.projectId ?? null,
    meeting_id: input.meetingId ?? null,
    recording_expires_at: recordingExpiresAt()
  });
  // Key is built from OUR organization id and OUR id, never from the request.
  recording.storage_key = buildRecordingStorageKey(
    organizationId,
    recordingId.toString(),
    declaredType
  );
  await recording.save();

  return recording;
};

export const getRecordingUploadUrlService = async (
  recordingId: string,
  organizationId: string
): Promise<{ uploadUrl: string; expiresIn: number; maxSizeBytes: number }> => {
  requireOrganizationId(organizationId, 'upload a recording');
  assertObjectId(recordingId, 'recordingId');

  const recording = await findScopedRecording(recordingId, organizationId);
  if (recording.recording_status !== 'PENDING') {
    throw ApiError.badRequest(`Recording is not awaiting upload (status: ${recording.recording_status})`);
  }

  // Re-signing the server-derived key is safe and lets a failed upload retry.
  const uploadUrl = await createUploadUrl(recording.storage_key, recording.recording_mime_type, UPLOAD_URL_TTL_SECONDS);

  return { uploadUrl, expiresIn: UPLOAD_URL_TTL_SECONDS, maxSizeBytes: MAX_RECORDING_SIZE_BYTES };
};

export const completeRecordingService = async (
  recordingId: string,
  organizationId: string,
  durationMs: number,
  userId: string
): Promise<RecordingDocument> => {
  requireOrganizationId(organizationId, 'complete a recording');
  assertObjectId(recordingId, 'recordingId');

  const recording = await findScopedRecording(recordingId, organizationId);
  if (recording.recording_status !== 'PENDING') {
    throw ApiError.badRequest(`Recording is not awaiting upload (status: ${recording.recording_status})`);
  }

  // HeadObject is authoritative for both type and size. Nothing the client
  // claimed about its own upload is trusted.
  const metadata = await headObject(recording.storage_key);
  if (!metadata.exists) {
    throw ApiError.badRequest('Uploaded object was not found in storage');
  }
  if (!metadata.contentType || !isAllowedRecordingMimeType(metadata.contentType)) {
    await deleteObject(recording.storage_key).catch(() => undefined);
    recording.recording_status = 'FAILED';
    await recording.save();
    throw ApiError.badRequest('Uploaded object has an unsupported content type');
  }
  const sizeBytes = metadata.contentLength ?? 0;
  if (sizeBytes <= 0) {
    await deleteObject(recording.storage_key).catch(() => undefined);
    recording.recording_status = 'FAILED';
    await recording.save();
    throw ApiError.badRequest('Uploaded object is empty');
  }
  if (sizeBytes > MAX_RECORDING_SIZE_BYTES) {
    // Policy limit enforced against the real object, then removed.
    await deleteObject(recording.storage_key).catch(() => undefined);
    recording.recording_status = 'FAILED';
    await recording.save();
    throw ApiError.badRequest('Uploaded object exceeds the maximum recording size');
  }

  recording.recording_mime_type = metadata.contentType;
  recording.recording_size_bytes = sizeBytes;
  recording.recording_duration_ms = Math.max(0, Math.min(durationMs, MAX_RECORDING_DURATION_MS));
  recording.recording_status = 'READY';
  recording.recording_expires_at = recordingExpiresAt();
  await recording.save();

  await runPostProcessing(recording, organizationId, userId);

  return recording;
};

/**
 * Seam for transcription and summarisation.
 *
 * Today it runs inline, which is correct for a 60-second recording on a local
 * CPU. Swapping this ONE call for a queue enqueue moves processing to a worker
 * without changing any endpoint contract or public Recording API.
 */
const runPostProcessing = async (
  recording: RecordingDocument,
  organizationId: string,
  userId: string
): Promise<void> => {
  try {
    // Awaited so failures are recorded rather than lost, but never allowed to
    // fail the upload: the recording is already valid and stored.
    await recordingPostProcessingService.runPostProcessing(recording.recordingId, organizationId, userId);
  } catch (error) {
    logger.error(`Post-processing failed for recording: ${(error as Error).message}`);
  }
};

export const getRecordingsService = async (
  organizationId: string,
  query: IRecordingListQuery
) => {
  requireOrganizationId(organizationId, 'list recordings');

  const filter: Record<string, unknown> = { organization_id: organizationId };
  if (query.projectId) filter.project_id = assertObjectId(query.projectId, 'projectId');
  if (query.meetingId) filter.meeting_id = assertObjectId(query.meetingId, 'meetingId');
  if (query.status) filter.recording_status = query.status;

  return findPaginated(Recording, filter, query, { populate: RECORDING_POPULATE, sort: { created_at: -1 } });
};

export const getRecordingByIdService = async (recordingId: string, organizationId: string) => {
  requireOrganizationId(organizationId, 'view a recording');
  assertObjectId(recordingId, 'recordingId');

  await findScopedRecording(recordingId, organizationId);
  const recording = await findPopulatedRecording(recordingId);
  if (!recording) {
    throw ApiError.notFound('Recording not found');
  }
  return recording;
};

export const getRecordingDownloadUrlService = async (recordingId: string, organizationId: string) => {
  requireOrganizationId(organizationId, 'download a recording');
  assertObjectId(recordingId, 'recordingId');

  const recording = await findScopedRecording(recordingId, organizationId);
  if (recording.recording_status !== 'READY') {
    throw ApiError.badRequest('Recording is not available for download');
  }
  const metadata = await headObject(recording.storage_key);
  if (!metadata.exists) {
    throw ApiError.notFound('Recording file not found in storage');
  }

  // The bucket stays private; this short-lived URL is the capability.
  const downloadUrl = await createDownloadUrl(recording.storage_key, DOWNLOAD_URL_TTL_SECONDS);
  return { downloadUrl, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
};

export const deleteRecordingService = async (recordingId: string, organizationId: string, userId: string) => {
  requireOrganizationId(organizationId, 'delete a recording');
  assertObjectId(recordingId, 'recordingId');

  const recording = await findScopedRecording(recordingId, organizationId);
  if (recording.recording_status === 'DELETED') {
    throw ApiError.badRequest('Recording is already deleted');
  }

  const isOwner = toObjectIdString(recording.created_by) === userId;
  const isSuperAdmin = await User.exists({ _id: userId, is_super_admin: true });
  if (!isOwner && !isSuperAdmin) {
    throw ApiError.forbidden('Only the recording owner or an organization admin may delete it');
  }

  await deleteObject(recording.storage_key);

  // Soft delete: recording_expires_at stays the lifecycle source of truth.
  recording.recording_status = 'DELETED';
  recording.recording_expires_at = new Date();
  await recording.save();

  return recording;
};
