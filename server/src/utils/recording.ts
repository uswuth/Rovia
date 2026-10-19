import { ApiError } from './apiError.js';
import { assertObjectId } from './objectId.js';

/** Recording limits and policy. Values are measured, not guessed — see client/docs/SCREEN_RECORDING_CAPTURE.md for the browser spike that produced them. */

/** Recorded meetings are captured whole, so there is no duration cap. A one-hour meeting is ordinary input, not an abuse case: the browser is the only thing holding the buffer, so a cap here would only reject a meeting the user legitimately wanted transcribed. What still needs a ceiling is object SIZE, because a client controls its own upload. That limit is a POLICY value, and complete() treats the object store's reported length as the fact and deletes anything larger. Sized for a long recording: ~2 hours of screen-and-audio VP8 at 1 Mbps is roughly 900 MB. Whisper never sees this file — the server demuxes it to trimmed 16 kHz mono FLAC before transcription — so this only bounds storage. */
export const MAX_RECORDING_SIZE_BYTES = 1_073_741_824; 
export const RECORDING_TTL_DAYS = 30;
export const UPLOAD_URL_TTL_SECONDS = 120;
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/** One in-flight upload per organization, mirroring the PROJECT_*_LIMIT pattern. */
export const MAX_PENDING_RECORDINGS_PER_ORG = 5;

/** Validated against the MIME type MediaRecorder actually EMITTED, which is not always the type the browser requested. Audio is what the meeting recorder captures: one track per participant, mono Opus at a low bitrate, so a full hour per speaker stays inside the transcription API's per-file ceiling without any server-side conversion. The video entries remain for any caller that still records a picture. */
export const RECORDING_MIME_ALLOWLIST = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'video/webm',
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp9,opus',
  'video/mp4',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
] as const;

/** Case-insensitive exact match on the allowlist. */
export const isAllowedRecordingMimeType = (mimeType: string): boolean =>
  RECORDING_MIME_ALLOWLIST.some((allowed) => allowed.toLowerCase() === mimeType.trim().toLowerCase());

/** Storage extension derives from the VALIDATED mime type, never hardcoded. A recording key keeps its container so a mixed recording set stays playable. */
export const extensionForMimeType = (mimeType: string): string => {
  const normalised = mimeType.trim().toLowerCase();
  if (normalised.startsWith('audio/webm')) return 'webm';
  if (normalised.startsWith('audio/ogg')) return 'ogg';
  if (normalised.startsWith('video/mp4')) return 'mp4';
  if (normalised.startsWith('video/webm')) return 'webm';
  throw ApiError.badRequest(`Unsupported recording content type: ${mimeType}`);
};

/**
 * The ONLY place a storage key is built. It is always derived from the caller's
 * own organization id, so a client can never address another tenant's object.
 *
 * Speaker index is part of the key: each participant's audio is a separate
 * object, so the server can transcribe tracks independently and no client's
 * upload can overwrite another's.
 */
export const buildRecordingStorageKey = (
  organizationId: string,
  recordingId: string,
  mimeType: string,
  speakerIndex = 0
): string => {
  if (!organizationId) {
    throw ApiError.badRequest('An organization is required to build a storage key');
  }
  assertObjectId(recordingId, 'recordingId');
  if (!Number.isInteger(speakerIndex) || speakerIndex < 0 || speakerIndex > 99) {
    throw ApiError.badRequest('Speaker index must be a whole number between 0 and 99');
  }
  const extension = extensionForMimeType(mimeType);
  return `recordings/${organizationId}/${recordingId}/speaker-${speakerIndex}.${extension}`;
};

/** Defence in depth for reads/deletes: the key must sit under the caller's org. */
export const assertStorageKeyOwnedBy = (storageKey: string, organizationId: string): void => {
  if (!storageKey.startsWith(`recordings/${organizationId}/`)) {
    throw ApiError.forbidden('Storage key does not belong to your organization');
  }
};

export const recordingExpiresAt = (from: Date = new Date()): Date =>
  new Date(from.getTime() + RECORDING_TTL_DAYS * 24 * 60 * 60 * 1000);
