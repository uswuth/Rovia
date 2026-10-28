/** Mirrors the server models' toJSON projections; fields are optional until the record is terminal. */

export type RecordingStatus = 'PENDING' | 'READY' | 'FAILED' | 'DELETED';
export type AiStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Recording {
  recordingId?: string;
  recordingStatus?: RecordingStatus;
  recordingMimeType?: string;
  recordingSizeBytes?: number;
  recordingDurationMs?: number;
  organizationId?: string;
  projectId?: string | null;
  meetingId?: string | null;
  createdBy?: string;
  recordingExpiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordingWithAiStatus extends Recording {
  transcriptionStatus?: AiStatus;
  summaryStatus?: AiStatus;
}

export interface TranscriptSegment {
  startMs?: number;
  endMs?: number;
  text?: string;
}

export interface TranscriptSpeaker {
  speakerId?: string;
  speakerName?: string;
  speakerText?: string;
  speakerDurationMs?: number;
  /** False when that participant's track held no speech. */
  spoke?: boolean;
}

export interface Transcript {
  transcriptId?: string;
  transcriptStatus?: AiStatus;
  transcriptText?: string;
  transcriptLanguage?: string | null;
  transcriptDurationMs?: number;
  transcriptSegmentCount?: number;
  /** One entry per participant, each transcribed from their own track. */
  transcriptSpeakers?: TranscriptSpeaker[];
  organizationId?: string;
  recordingId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SummaryActionItem {
  text?: string;
  assignee?: string | null;
}

export interface MeetingSummary {
  summaryId?: string;
  summaryStatus?: AiStatus;
  summaryText?: string;
  summaryKeyPoints?: string[];
  summaryActionItems?: SummaryActionItem[];
  organizationId?: string;
  recordingId?: string;
  transcriptId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRecordingInput {
  /** Must be one of the server's allowlisted container formats. */
  contentType: string;
  projectId?: string;
  meetingId?: string;
  /** One entry per participant whose audio is captured. */
  speakers?: Array<{ speakerId: string; speakerName?: string }>;
}

export interface UploadUrlResponse {
  uploadUrl?: string;
  expiresIn?: number;
  /** Server-authoritative ceiling. The upload is deleted server-side if exceeded. */
  maxSizeBytes?: number;
}

export interface DownloadUrlResponse {
  downloadUrl?: string;
  expiresIn?: number;
}

/** Mirrors `buildPaginatedResult` on the server: list payloads are `{ items, pagination }`. */
export interface RecordingListResponse {
  items?: RecordingWithAiStatus[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}