import { Request } from 'express';
import { ApiError } from './apiError.js';

/** Controllers must not read req.user field by field; that repeated pattern made it easy to forget one. */
export const getRequestScope = (req: Request): { userId: string; organizationId: string } => ({
  userId: req.user?.id || '',
  organizationId: req.user?.organizationId || ''
});

/** Guard at the top of every org-scoped service; replaces the hand-rolled copy in six places. */
export const requireOrganizationId = (organizationId: string, action: string): string => {
  if (!organizationId) {
    throw ApiError.badRequest(`User must belong to an organization to ${action}`);
  }
  return organizationId;
};
