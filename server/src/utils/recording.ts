import { ApiError } from './apiError.js';
import { assertObjectId } from './objectId.js';

/**
 * Recording limits and policy. Values are measured, not guessed — see
 * client/docs/SCREEN_RECORDING_CAPTURE.md for the browser spike that produced
 * them.
 */

/** MVP cap. Enforced in the browser only; the server records what was measured. */
export const MAX_RECORDING_DURATION_MS = 60_000;

/**
 * Server-authoritative object size ceiling. This is a POLICY limit: a client
 * controls its own upload, so complete() must treat HeadObject.ContentLength as
 * the fact and delete anything larger.
 */
export const MAX_RECORDING_SIZE_BYTES = 25_678_900; // 25 MiB

export const RECORDING_TTL_DAYS = 30;
export const UPLOAD_URL_TTL_SECONDS = 120;
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/** One in-flight upload per organization, mirroring the PROJECT_*_LIMIT pattern. */
export const MAX_PENDING_RECORDINGS_PER_ORG = 5;

/**
 * Validated against the MIME type MediaRecorder actually EMITTED, which is not
 * always the type the browser requested.
 */
export const RECORDING_MIME_ALLOWLIST = [
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

/** Storage extension derives from the VALIDATED mime type, never hardcoded. */
export const extensionForMimeType = (mimeType: string): string => {
  const normalised = mimeType.trim().toLowerCase();
  if (normalised.startsWith('video/mp4')) return 'mp4';
  if (normalised.startsWith('video/webm')) return 'webm';
  throw ApiError.badRequest(`Unsupported recording content type: ${mimeType}`);
};

/**
 * The ONLY place a storage key is built. It is always derived from the caller's
 * own organization id, so a client can never address another tenant's object.
 */
export const buildRecordingStorageKey = (organizationId: string, recordingId: string, mimeType: string): string => {
  if (!organizationId) {
    throw ApiError.badRequest('An organization is required to build a storage key');
  }
  assertObjectId(recordingId, 'recordingId');
  return `recordings/${organizationId}/${recordingId}.${extensionForMimeType(mimeType)}`;
};

/** Defence in depth for reads/deletes: the key must sit under the caller's org. */
export const assertStorageKeyOwnedBy = (storageKey: string, organizationId: string): void => {
  if (!storageKey.startsWith(`recordings/${organizationId}/`)) {
    throw ApiError.forbidden('Storage key does not belong to your organization');
  }
};

export const recordingExpiresAt = (from: Date = new Date()): Date =>
  new Date(from.getTime() + RECORDING_TTL_DAYS * 24 * 60 * 60 * 1000);
