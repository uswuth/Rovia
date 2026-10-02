import fs from 'node:fs/promises';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

/**
 * The only module that talks to object storage. Everything else goes through
 * these functions, so the local (Floci) and production (R2) difference is a
 * single environment variable rather than a code change: both speak S3.
 */

const credentials =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined;

const baseConfig = {
  region: env.AWS_REGION,
  // R2 requires path-style addressing; setting it unconditionally keeps local
  // and production on one code path.
  forcePathStyle: true,
  ...(credentials ? { credentials } : {})
};

/**
 * Client the SERVER uses for its own calls (HeadObject, DeleteObject, reads for
 * transcription). In Docker this must be the in-network hostname.
 */
const s3Internal = new S3Client({
  ...baseConfig,
  ...(env.AWS_ENDPOINT_URL ? { endpoint: env.AWS_ENDPOINT_URL } : {})
});

/**
 * Client used ONLY to presign URLs that a BROWSER will call. A browser cannot
 * resolve a Compose-internal hostname, so the signed URL must carry the
 * host-reachable endpoint. Signing is host-agnostic: only the URL differs.
 */
const s3Public = new S3Client({
  ...baseConfig,
  ...(env.AWS_PUBLIC_ENDPOINT_URL
    ? { endpoint: env.AWS_PUBLIC_ENDPOINT_URL }
    : env.AWS_ENDPOINT_URL
      ? { endpoint: env.AWS_ENDPOINT_URL }
      : {})
});

const requireBucket = (): string => {
  if (!env.AWS_S3_BUCKET) {
    throw new ApiError(500, 'Object storage is not configured');
  }
  return env.AWS_S3_BUCKET;
};

export const createUploadUrl = async (key: string, contentType: string, expiresIn: number): Promise<string> =>
  getSignedUrl(s3Public, new PutObjectCommand({ Bucket: requireBucket(), Key: key, ContentType: contentType }), {
    expiresIn
  });

/** Short-lived presigned GET. The bucket stays private; the URL is the capability. */
export const createDownloadUrl = async (key: string, expiresIn: number): Promise<string> =>
  getSignedUrl(s3Public, new GetObjectCommand({ Bucket: requireBucket(), Key: key }), { expiresIn });

export interface ObjectMetadata {
  contentType: string | null;
  contentLength: number | null;
  exists: boolean;
}

/** Authoritative object facts. Used by complete() to validate an upload. */
export const headObject = async (key: string): Promise<ObjectMetadata> => {
  try {
    const result = await s3Internal.send(new HeadObjectCommand({ Bucket: requireBucket(), Key: key }));
    return {
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
      exists: true
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) {
      return { contentType: null, contentLength: null, exists: false };
    }
    logger.error(`headObject failed for key: ${(error as Error).message}`);
    throw new ApiError(500, 'Could not verify the uploaded object');
  }
};

/**
 * Streams a stored object to disk. Used by post-processing to feed the audio
 * extractor. The object is the authoritative recording and is only read, never
 * moved or rewritten.
 */
export const downloadObjectToFile = async (key: string, destinationPath: string): Promise<void> => {
  try {
    const result = await s3Internal.send(new GetObjectCommand({ Bucket: requireBucket(), Key: key }));
    if (!result.Body) {
      throw new ApiError(500, 'Stored object had no body');
    }
    const stream = result.Body as unknown as AsyncIterable<Uint8Array>;
    const handle = await fs.open(destinationPath, 'w');
    try {
      for await (const chunk of stream) {
        await handle.write(chunk);
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error(`downloadObjectToFile failed: ${(error as Error).message}`);
    throw new ApiError(500, 'Could not read the stored recording');
  }
};

export const deleteObject = async (key: string): Promise<void> => {
  try {
    await s3Internal.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
  } catch (error) {
    logger.error(`deleteObject failed for key: ${(error as Error).message}`);
    throw new ApiError(500, 'Could not delete the object');
  }
};
