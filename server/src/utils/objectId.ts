import { Types } from 'mongoose';
import { ApiError } from './apiError.js';

export const assertObjectId = (value: string, field: string): string => {
  if (!value || !Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${field}`, [{ field, message: `Invalid ${field}` }]);
  }
  return value;
};

export const toObjectIdString = (value: unknown): string => {
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};
