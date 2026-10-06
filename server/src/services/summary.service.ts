import { Summary, SummaryDocument } from '../models/summary.model.js';
import { Recording } from '../models/recording.model.js';
import { ApiError } from '../utils/apiError.js';
import { assertObjectId } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { SummarizationResult } from '../types/index.js';

/** Tenant-scoped, exactly like findScopedProject. */
export const findScopedSummary = async (summaryId: string, organizationId: string): Promise<SummaryDocument> => {
  const summary = await Summary.findOne({ _id: summaryId, organization_id: organizationId });
  if (!summary) {
    throw ApiError.notFound('Summary not found');
  }
  return summary;
};

const findByTranscript = async (transcriptId: string, organizationId: string): Promise<SummaryDocument | null> =>
  Summary.findOne({ transcript_id: transcriptId, organization_id: organizationId });

/** Idempotency: one summary per transcript, reused on retry. */
export const startSummaryService = async (
  transcriptId: string,
  recordingId: string,
  organizationId: string,
  userId: string
): Promise<SummaryDocument> => {
  requireOrganizationId(organizationId, 'summarise a recording');
  assertObjectId(transcriptId, 'transcriptId');
  assertObjectId(recordingId, 'recordingId');

  const recording = await Recording.findOne({ _id: recordingId, organization_id: organizationId });
  if (!recording) {
    throw ApiError.notFound('Recording not found');
  }

  const existing = await findByTranscript(transcriptId, organizationId);
  if (existing) {
    existing.summary_status = 'PROCESSING';
    await existing.save();
    return existing;
  }

  return new Summary({
    organization_id: organizationId,
    recording_id: recordingId,
    transcript_id: transcriptId,
    created_by: userId,
    summary_status: 'PROCESSING'
  }).save();
};

export const completeSummaryService = async (
  summaryId: string,
  organizationId: string,
  result: SummarizationResult
): Promise<SummaryDocument> => {
  const summary = await findScopedSummary(summaryId, organizationId);
  summary.summary_text = result.summary;
  summary.summary_key_points = result.keyPoints;
  summary.summary_action_items = result.actionItems.map((item) => ({ text: item.text, assignee: item.assignee }));
  summary.summary_status = 'READY';
  await summary.save();
  return summary;
};

export const failSummaryService = async (summaryId: string, organizationId: string): Promise<void> => {
  const summary = await findScopedSummary(summaryId, organizationId);
  summary.summary_status = 'FAILED';
  await summary.save();
};

export const getSummaryByRecordingService = async (
  recordingId: string,
  organizationId: string
): Promise<SummaryDocument> => {
  requireOrganizationId(organizationId, 'view a summary');
  assertObjectId(recordingId, 'recordingId');

  const summary = await Summary.findOne({ recording_id: recordingId, organization_id: organizationId });
  if (!summary) {
    throw ApiError.notFound('Summary not found');
  }
  return summary;
};

export const getSummaryStatusService = async (
  recordingId: string,
  organizationId: string
): Promise<'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | null> => {
  const summary = await Summary.findOne({ recording_id: recordingId, organization_id: organizationId });
  return summary ? summary.summary_status : null;
};

export const getSummariesService = async (organizationId: string, query: Record<string, unknown>) => {
  requireOrganizationId(organizationId, 'list summaries');
  const filter: Record<string, unknown> = { organization_id: organizationId };
  if (query.recordingId) filter.recording_id = assertObjectId(String(query.recordingId), 'recordingId');
  return findPaginated(Summary, filter, query, { sort: { created_at: -1 } });
};
