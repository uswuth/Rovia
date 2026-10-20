import crypto from 'crypto';
import { ENTITY_PREFIXES, EntityPrefix } from '../constants/entityPrefixes.js';

export { ENTITY_PREFIXES, type EntityPrefix };

// Non-ambiguous character pool (excludes 0, O, 1, I, L to prevent user confusion)
const CHAR_POOL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const generateHardShuffledCode = (length = 6): string => {
  const randomBytes = crypto.randomBytes(length * 2);
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % CHAR_POOL.length;
    result += CHAR_POOL[randomIndex];
  }

  return result;
};

export const cleanPrefix = (prefix: string, maxLen = 6, fallback = 'INTEL'): string => {
  const cleaned = (prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
};

export const formatSequentialCode = (prefix: EntityPrefix, count: number): string => {
  const normalizedPrefix = cleanPrefix(prefix, 6, 'CODE');
  const nextNum = (count + 1).toString().padStart(3, '0');
  return `${normalizedPrefix}${nextNum}`;
};

export interface CodeGeneratorModel {
  countDocuments(query?: unknown): Promise<number>;
  findOne(query: Record<string, unknown>): { lean(): Promise<unknown> } | Promise<unknown>;
}

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

export const generateOrgInviteCode = (orgSlugOrName: string): string => {
  const prefix = cleanPrefix(orgSlugOrName, 4, ENTITY_PREFIXES.ORGANIZATION);
  const shuffle = generateHardShuffledCode(6);
  return `${prefix}-${shuffle}`;
};

export const generateProjectCode = async (
  model: CodeGeneratorModel,
  organizationId?: string
): Promise<string> => {
  const filter = organizationId ? { organization_id: organizationId } : {};
  return generateSequentialCode(ENTITY_PREFIXES.PROJECT, model, 'project_code', filter);
};

export const generateSessionCode = async (
  _model?: CodeGeneratorModel,
  _organizationId?: string
): Promise<string> => {
  // UUID v7: time-sortable 128-bit UUID ensuring global uniqueness across all organizations
  const bytes = crypto.randomBytes(16);
  const now = Date.now();

  // 48-bit timestamp
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // version 7 (0b0111)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // variant RFC 4122 (0b10)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
