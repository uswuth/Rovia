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
  getAllOrganizationsAdminService,
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

export const getAllOrganizations = async (_req: Request, res: Response): Promise<Response> => {
  const result = await getAllOrganizationsAdminService();

  return ApiResponse.success(
    res,
    'Organizations retrieved successfully',
    result,
    200
  );
};

interface AuthUserRequest {
  _id?: { toString(): string } | string;
  id?: string;
  is_super_admin?: boolean;
  isSuperAdmin?: boolean;
  user_role?: string;
  userRole?: string;
  organization_id?: { _id?: { toString(): string } | string } | string;
  organizationId?: { _id?: { toString(): string } | string } | string;
}

export const provisionUser = async (req: Request, res: Response): Promise<Response> => {
  const currentUser = req.user as IJwtPayload;
  const isGlobalSuperAdmin = Boolean(
    currentUser?.isSuperAdmin || currentUser?.userRole === 'SuperAdmin'
  );

  const userOrg = currentUser?.organizationId;
  const userOrgId = userOrg ? String(userOrg) : undefined;

  let targetOrgId = req.body.organizationId;
  if (!targetOrgId || !isGlobalSuperAdmin) {
    targetOrgId = targetOrgId || userOrgId;
  }

  if (!targetOrgId) {
    throw ApiError.badRequest('Target Organization is required');
  }

  const result = await provisionUserService({
    ...req.body,
    organizationId: targetOrgId
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
  const result = await updateUserService(userId, req.body);

  return ApiResponse.success(
    res,
    'User updated successfully',
    result,
    200
  );
};

export const getAllUsersAdmin = async (req: Request, res: Response): Promise<Response> => {
  const currentUser = req.user as IJwtPayload;
  const isGlobalSuperAdmin = Boolean(
    currentUser?.isSuperAdmin || currentUser?.userRole === 'SuperAdmin'
  );

  const userOrg = currentUser?.organizationId;
  const userOrgId = userOrg ? String(userOrg) : undefined;

  let orgFilter: string | undefined = undefined;
  if (!isGlobalSuperAdmin) {
    orgFilter = userOrgId;
  } else if (typeof req.query.organizationId === 'string' && req.query.organizationId) {
    orgFilter = req.query.organizationId;
  }

  const result = await getAllUsersAdminService(orgFilter);

  return ApiResponse.success(
    res,
    'Users retrieved successfully',
    result,
    200
  );
};




