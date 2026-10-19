import client from '../client';
import type {
  CreateRecordingInput,
  MeetingSummary,
  Recording,
  RecordingListResponse,
  RecordingWithAiStatus,
  Transcript,
  DownloadUrlResponse,
  UploadUrlResponse,
} from './recording.types';

/** Recording + AI pipeline API. The client never constructs a storage key: the server derives it from the caller's organization. Uploads go straight to object storage through a presigned URL, so media bytes never pass through the API process. */

/** Server allowlist. A type outside it is rejected by createRecording. */
const ALLOWED_CONTENT_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'video/webm',
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp9,opus',
  'video/mp4',
] as const;

export const isSupportedRecordingType = (mimeType: string): boolean =>
  ALLOWED_CONTENT_TYPES.some(
    (allowed) => allowed.toLowerCase() === mimeType.trim().toLowerCase()
  );

export const createRecording = async (input: CreateRecordingInput): Promise<Recording> => {
  const { data } = await client.post<{ data: Recording }>('/recordings', input);
  return data.data;
};

export const getRecordings = async (params?: {
  status?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}): Promise<RecordingListResponse> => {
  const { data } = await client.get<{ data: RecordingListResponse }>('/recordings', { params });
  return data.data;
};

export const getRecording = async (recordingId: string): Promise<RecordingWithAiStatus> => {
  const { data } = await client.get<{ data: RecordingWithAiStatus }>(`/recordings/${recordingId}`);
  return data.data;
};

export const getRecordingUploadUrl = async (
  recordingId: string,
  speakerIndex = 0
): Promise<UploadUrlResponse> => {
  const { data } = await client.post<{ data: UploadUrlResponse }>(
    `/recordings/${recordingId}/upload-url`,
    undefined,
    { params: { speaker: speakerIndex } }
  );
  return data.data;
};

export const completeRecording = async (
  recordingId: string,
  payload?: { durationMs?: number }
): Promise<RecordingWithAiStatus> => {
  const { data } = await client.post<{ data: RecordingWithAiStatus }>(
    `/recordings/${recordingId}/complete`,
    payload ?? {}
  );
  return data.data;
};

export const getRecordingDownloadUrl = async (
  recordingId: string
): Promise<DownloadUrlResponse> => {
  const { data } = await client.post<{ data: DownloadUrlResponse }>(
    `/recordings/${recordingId}/download-url`
  );
  return data.data;
};

export const deleteRecording = async (recordingId: string): Promise<void> => {
  await client.delete(`/recordings/${recordingId}`);
};

/**
 * Returns 404 until post-processing reaches READY. Callers must poll rather
 * than treat a 404 as a permanent failure: a recording created seconds ago has
 * no transcript yet.
 */
export const getRecordingTranscript = async (recordingId: string): Promise<Transcript> => {
  const { data } = await client.get<{ data: Transcript }>(`/recordings/${recordingId}/transcript`);
  return data.data;
};

export const getRecordingSummary = async (recordingId: string): Promise<MeetingSummary> => {
  const { data } = await client.get<{ data: MeetingSummary }>(`/recordings/${recordingId}/summary`);
  return data.data;
};

/**
 * Uploads the recorded blob directly to object storage.
 *
 * Uses fetch rather than the shared Axios instance: the presigned URL points at
 * S3, which rejects our auth header and CORS credentials, so the shared client's
 * bearer token would break the signature.
 */
export const uploadRecordingBlob = async (
  recordingId: string,
  blob: Blob,
  mimeType: string,
  speakerIndex = 0
): Promise<void> => {
  const { uploadUrl, maxSizeBytes } = await getRecordingUploadUrl(recordingId, speakerIndex);
  if (!uploadUrl) {
    throw new Error('Could not obtain an upload URL for this recording');
  }
  if (maxSizeBytes && blob.size > maxSizeBytes) {
    throw new Error('Recording is larger than the maximum allowed size');
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};