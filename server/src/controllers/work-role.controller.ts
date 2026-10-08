import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  createWorkRoleService,
  getWorkRolesByOrgService,
  updateWorkRoleService,
  deleteWorkRoleService
} from '../services/work-role.service.js';

interface AuthUserRequest {
  _id?: { toString(): string } | string;
  id?: string;
  organization_id?: unknown;
  organizationId?: unknown;
  orgId?: unknown;
}

const extractOrgId = (val: unknown): string | undefined => {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    return (
      (obj._id?.toString() as string) ||
      (obj.organizationId?.toString() as string) ||
      (obj.id?.toString() as string)
    );
  }
  return undefined;
};

export const createWorkRole = async (req: Request, res: Response): Promise<Response> => {
  const currentUser = req.user as AuthUserRequest | undefined;
  const userOrgId =
    extractOrgId(currentUser?.organization_id) ||
    extractOrgId(currentUser?.organizationId) ||
    extractOrgId(currentUser?.orgId) ||
    req.body.organizationId;

  const result = await createWorkRoleService({
    ...req.body,
    organizationId: userOrgId,
  });

  return ApiResponse.success(res, 'Work role created successfully', result, 201);
};

export const getWorkRoles = async (req: Request, res: Response): Promise<Response> => {
  const currentUser = req.user as AuthUserRequest | undefined;
  const userOrgId =
    extractOrgId(currentUser?.organization_id) ||
    extractOrgId(currentUser?.organizationId) ||
    extractOrgId(currentUser?.orgId) ||
    '';

  const result = await getWorkRolesByOrgService(userOrgId);
  return ApiResponse.success(res, 'Work roles retrieved successfully', result, 200);
};

export const updateWorkRole = async (req: Request, res: Response): Promise<Response> => {
  const { roleId } = req.params;
  const currentUser = req.user as AuthUserRequest | undefined;
  const userOrgId =
    extractOrgId(currentUser?.organization_id) ||
    extractOrgId(currentUser?.organizationId) ||
    extractOrgId(currentUser?.orgId) ||
    '';

  const result = await updateWorkRoleService(roleId, userOrgId, req.body);
  return ApiResponse.success(res, 'Work role updated successfully', result, 200);
};

export const deleteWorkRole = async (req: Request, res: Response): Promise<Response> => {
  const { roleId } = req.params;
  const currentUser = req.user as AuthUserRequest | undefined;
  const userOrgId =
    extractOrgId(currentUser?.organization_id) ||
    extractOrgId(currentUser?.organizationId) ||
    extractOrgId(currentUser?.orgId) ||
    '';

  const result = await deleteWorkRoleService(roleId, userOrgId);
  return ApiResponse.success(res, result.message, null, 200);
};
