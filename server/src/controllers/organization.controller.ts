import { Request, Response } from 'express';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import { IJwtPayload } from '../types/user.types.js';
import {
  getMyOrganizationService,
  getOrganizationMembersService,
  getOrganizationMemberByIdService,
  createOrganizationByAdminService,
  getOwnOrganizationAdminService,
  provisionUserService,
  updateUserService,
  getAllUsersAdminService
} from '../services/organization.service.js';

export const getMyOrganization = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const result = await getMyOrganizationService(organizationId);

  return ApiResponse.success(
    res,
    'Organization details retrieved',
    result,
    200
  );
};

export const getOrganizationMembers = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const result = await getOrganizationMembersService(organizationId, req.query as Record<string, unknown>);

  return ApiResponse.success(
    res,
    'Organization members retrieved successfully',
    result,
    200
  );
};

export const getOrganizationMemberById = async (req: Request, res: Response): Promise<Response> => {
  const scope = getRequestScope(req);
  const currentUser = req.user as IJwtPayload;
  const { memberId } = req.params;
  const result = await getOrganizationMemberByIdService(scope.organizationId, memberId, {
    userId: scope.userId,
    userRole: currentUser?.userRole,
    isSuperAdmin: currentUser?.isSuperAdmin
  });

  return ApiResponse.success(
    res,
    'Member profile retrieved successfully',
    result,
    200
  );
};



export const createOrganization = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  const result = await createOrganizationByAdminService(req.body, userId);

  return ApiResponse.success(
    res,
    'Organization created successfully',
    result,
    201
  );
};

export const getAllOrganizations = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const result = await getOwnOrganizationAdminService(organizationId);

  return ApiResponse.success(
    res,
    'Organizations retrieved successfully',
    result,
    200
  );
};

export const provisionUser = async (req: Request, res: Response): Promise<Response> => {
  // The tenant always comes from the verified token. A body-supplied organizationId
  // that points at another tenant is rejected rather than silently ignored.
  const { organizationId } = getRequestScope(req);
  const requestedOrgId =
    typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';

  if (requestedOrgId && requestedOrgId !== organizationId) {
    throw ApiError.forbidden('You can only provision users into your own organization');
  }

  const result = await provisionUserService({
    ...req.body,
    organizationId
  });

  return ApiResponse.success(
    res,
    'IAM User provisioned successfully',
    result,
    201
  );
};

export const updateUserAdmin = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { organizationId } = getRequestScope(req);
  const result = await updateUserService(userId, req.body, organizationId);

  return ApiResponse.success(
    res,
    'User updated successfully',
    result,
    200
  );
};

export const getAllUsersAdmin = async (req: Request, res: Response): Promise<Response> => {
  // Org owners carry isSuperAdmin by design, so neither the flag nor the role may
  // widen this list. The tenant is always the caller's own organization.
  const { organizationId } = getRequestScope(req);
  const result = await getAllUsersAdminService(organizationId);

  return ApiResponse.success(
    res,
    'Users retrieved successfully',
    result,
    200
  );
};




