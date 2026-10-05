import crypto from 'crypto';
import { ENTITY_PREFIXES, EntityPrefix } from '../constants/entityPrefixes.js';

export { ENTITY_PREFIXES, type EntityPrefix };

// Non-ambiguous character pool (excludes 0, O, 1, I, L to prevent user confusion)
const CHAR_POOL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically secure, hard-shuffled random string of specified length.
 */
export const generateHardShuffledCode = (length = 6): string => {
  const randomBytes = crypto.randomBytes(length * 2);
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % CHAR_POOL.length;
    result += CHAR_POOL[randomIndex];
  }

  return result;
};

/**
 * Format helper to clean and normalize prefixes (uppercase alphanumeric only)
 */
export const cleanPrefix = (prefix: string, maxLen = 6, fallback = 'INTEL'): string => {
  const cleaned = (prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
};

/**
 * Formats a prefix and number into a padded sequential code string.
 * Example: formatSequentialCode('PRJT', 0) -> 'PRJT001'
 */
export const formatSequentialCode = (prefix: EntityPrefix, count: number): string => {
  const normalizedPrefix = cleanPrefix(prefix, 6, 'CODE');
  const nextNum = (count + 1).toString().padStart(3, '0');
  return `${normalizedPrefix}${nextNum}`;
};

export interface CodeGeneratorModel {
  countDocuments(query?: unknown): Promise<number>;
  findOne(query: Record<string, unknown>): { lean(): Promise<unknown> } | Promise<unknown>;
}

/**
 * Dynamic Universal Code Generator with Collision Detection.
 * Reads prefixes from ENTITY_PREFIXES registry or any feature slug string.
 * Throws a clear error if the prefix is missing or invalid.
 * Automatically checks the database for duplicates to guarantee 100% collision-free codes.
 */
export const generateSequentialCode = async (
  prefix: EntityPrefix,
  model: CodeGeneratorModel,
  codeField: string,
  queryFilter: Record<string, unknown> = {}
): Promise<string> => {
  const normalizedPrefix = cleanPrefix(prefix, 6, '');
  if (!normalizedPrefix) {
    throw new Error('[CodeGenerator] A valid non-empty prefix or slug is required');
  }

  let count = await model.countDocuments(queryFilter);
  let code = formatSequentialCode(normalizedPrefix, count);
  let exists = await model.findOne({ ...queryFilter, [codeField]: code });

  let attempts = 0;
  while (exists) {
    count++;
    code = formatSequentialCode(normalizedPrefix, count);
    exists = await model.findOne({ ...queryFilter, [codeField]: code });
    attempts++;

    // Safety fallback: if 1000 sequential attempts collide, append a random hard-shuffled suffix
    if (attempts > 1000) {
      const randomSuffix = generateHardShuffledCode(4);
      code = `${normalizedPrefix}${count}-${randomSuffix}`;
      exists = await model.findOne({ ...queryFilter, [codeField]: code });
    }
  }

  return code;
};

/**
 * 1. Organization Invite Code Generator
 * Format: [ORG_PREFIX]-[HARD_SHUFFLED_CODE] (e.g., ACME-K9X3P7)
 */
export const generateOrgInviteCode = (orgSlugOrName: string): string => {
  const prefix = cleanPrefix(orgSlugOrName, 4, ENTITY_PREFIXES.ORGANIZATION);
  const shuffle = generateHardShuffledCode(6);
  return `${prefix}-${shuffle}`;
};

/**
 * 2. Project Code Generator
 * Uses sequential PRJT001 format
 */
export const generateProjectCode = async (
  model: CodeGeneratorModel,
  organizationId?: string
): Promise<string> => {
  const filter = organizationId ? { organization_id: organizationId } : {};
  return generateSequentialCode(ENTITY_PREFIXES.PROJECT, model, 'project_code', filter);
};

/**
 * 3. Meeting / Session Code Generator
 * Uses sequential MEET001 format
 */
export const generateSessionCode = async (
  model: CodeGeneratorModel,
  organizationId?: string
): Promise<string> => {
  const filter = organizationId ? { organization_id: organizationId } : {};
  return generateSequentialCode(ENTITY_PREFIXES.MEETING, model, 'meeting_join_code', filter);
};
