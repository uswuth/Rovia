import { Transcript, TranscriptDocument } from '../models/transcript.model.js';
import { Recording } from '../models/recording.model.js';
import { ApiError } from '../utils/apiError.js';
import { assertObjectId, toObjectIdString } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { TranscriptionResult } from '../types/index.js';

/** Tenant-scoped, exactly like findScopedProject. An id alone never grants access. */
export const findScopedTranscript = async (
  transcriptId: string,
  organizationId: string
): Promise<TranscriptDocument> => {
  const transcript = await Transcript.findOne({ _id: transcriptId, organization_id: organizationId });
  if (!transcript) {
    throw ApiError.notFound('Transcript not found');
  }
  return transcript;
};

const findByRecording = async (recordingId: string, organizationId: string): Promise<TranscriptDocument | null> =>
  Transcript.findOne({ recording_id: recordingId, organization_id: organizationId });

/**
 * Idempotency: one transcript per recording. A retry reuses the existing record
 * and moves it back to PROCESSING rather than creating a second one.
 */
export const startTranscriptService = async (
  recordingId: string,
  organizationId: string
): Promise<TranscriptDocument> => {
  requireOrganizationId(organizationId, 'transcribe a recording');
  assertObjectId(recordingId, 'recordingId');

  const recording = await Recording.findOne({ _id: recordingId, organization_id: organizationId });
  if (!recording) {
    throw ApiError.notFound('Recording not found');
  }

  const existing = await findByRecording(recordingId, organizationId);
  if (existing) {
    existing.transcript_status = 'PROCESSING';
    await existing.save();
    return existing;
  }

  return new Transcript({
    organization_id: organizationId,
    recording_id: recordingId,
    transcript_status: 'PROCESSING'
  }).save();
};

export const completeTranscriptService = async (
  transcriptId: string,
  organizationId: string,
  result: TranscriptionResult
): Promise<TranscriptDocument> => {
  const transcript = await findScopedTranscript(transcriptId, organizationId);
  transcript.transcript_text = result.text;
  transcript.transcript_language = result.language;
  transcript.transcript_duration_ms = result.durationMs ?? 0;
  transcript.transcript_segments = result.segments;
  transcript.transcript_status = 'READY';
  await transcript.save();
  return transcript;
};

export const failTranscriptService = async (transcriptId: string, organizationId: string): Promise<void> => {
  const transcript = await findScopedTranscript(transcriptId, organizationId);
  transcript.transcript_status = 'FAILED';
  await transcript.save();
};

export const getTranscriptByRecordingService = async (
  recordingId: string,
  organizationId: string
): Promise<TranscriptDocument> => {
  requireOrganizationId(organizationId, 'view a transcript');
  assertObjectId(recordingId, 'recordingId');

  const transcript = await findByRecording(recordingId, organizationId);
  if (!transcript) {
    throw ApiError.notFound('Transcript not found');
  }
  return transcript;
};

export const getTranscriptStatusService = async (
  recordingId: string,
  organizationId: string
): Promise<'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | null> => {
  const transcript = await findByRecording(recordingId, organizationId);
  return transcript ? transcript.transcript_status : null;
};

export const getTranscriptsService = async (organizationId: string, query: Record<string, unknown>) => {
  requireOrganizationId(organizationId, 'list transcripts');
  const filter: Record<string, unknown> = { organization_id: organizationId };
  if (query.recordingId) filter.recording_id = assertObjectId(String(query.recordingId), 'recordingId');
  return findPaginated(Transcript, filter, query, { sort: { created_at: -1 } });
};

export const transcriptRecordingId = (transcript: TranscriptDocument): string =>
  toObjectIdString(transcript.recording_id);
