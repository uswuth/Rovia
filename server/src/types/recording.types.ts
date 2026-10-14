import { RecordingStatus } from '../models/recording.model.js';

export interface ICreateRecordingInput {
  /** Declared up front, validated against the allowlist, later overwritten by HeadObject. */
  contentType: string;
  projectId?: string;
  /** Opaque id only; the Meeting domain does not exist yet. */
  meetingId?: string;
  /**
   * One entry per participant whose audio is captured. Each becomes its own
   * stored object so the tracks can be transcribed without crosstalk.
   */
  speakers?: Array<{ speakerId: string; speakerName?: string }>;
}

export interface IRecordingListQuery extends Record<string, unknown> {
  page?: string | number;
  limit?: string | number;
  projectId?: string;
  meetingId?: string;
  status?: RecordingStatus;
}

export type { RecordingStatus };
