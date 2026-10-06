/**
 * Centralized Entity Prefix Registry for Code Generation.
 * Frozen dictionary of prefixes to prevent accidental typos, spelling changes, or data corruption.
 */
export const ENTITY_PREFIXES = Object.freeze({
  PROJECT: 'PRJT',
  TASK: 'TASK',
  MEETING: 'MEET',
  USER: 'USER',
  ROLE: 'ROLE',
  JOB_TITLE: 'JOB',
  ORGANIZATION: 'ORG',
} as const);

export type EntityPrefixKey = keyof typeof ENTITY_PREFIXES;
export type EntityPrefix = (typeof ENTITY_PREFIXES)[EntityPrefixKey] | (string & {});
