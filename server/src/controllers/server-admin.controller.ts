import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  loginServerAdminService,
  getServerAdminMetricsService,
  createOrgAndGenerateCredentialsService,
  updateOrgServerAdminService,
  deleteOrgServerAdminService
} from '../services/server-admin.service.js';
import { getAllOrganizationsAdminService } from '../services/organization.service.js';

export const loginServerAdmin = async (req: Request, res: Response): Promise<Response> => {
  const { username, password } = req.body;
  const result = await loginServerAdminService(username, password);

  return ApiResponse.success(res, 'Server Admin login successful', result, 200);
};

export const getServerMetrics = async (_req: Request, res: Response): Promise<Response> => {
  const result = await getServerAdminMetricsService();
  return ApiResponse.success(res, 'Server metrics retrieved successfully', result, 200);
};

export const createOrgWithCredentials = async (req: Request, res: Response): Promise<Response> => {
  const result = await createOrgAndGenerateCredentialsService(req.body);
  return ApiResponse.success(res, 'Organization created and initial credentials generated', result, 201);
};

export const listAllOrganizationsServerAdmin = async (_req: Request, res: Response): Promise<Response> => {
  const result = await getAllOrganizationsAdminService();
  return ApiResponse.success(res, 'All organizations listed', result, 200);
};

export const updateOrgServerAdmin = async (req: Request, res: Response): Promise<Response> => {
  const { orgId } = req.params;
  const result = await updateOrgServerAdminService(orgId, req.body);
  return ApiResponse.success(res, 'Organization updated successfully', result, 200);
};

export const deleteOrgServerAdmin = async (req: Request, res: Response): Promise<Response> => {
  const { orgId } = req.params;
  const result = await deleteOrgServerAdminService(orgId);
  return ApiResponse.success(res, result.message, null, 200);
};
