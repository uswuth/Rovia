import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  listJobTitlesService,
  createJobTitleService,
  updateJobTitleService,
  deleteJobTitleService,
  assignJobTitleService,
} from '../services/job-title.service.js';

export const listJobTitles = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const result = await listJobTitlesService(organizationId);
  return ApiResponse.success(res, 'Job titles retrieved successfully', result, 200);
};

export const createJobTitle = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { title } = req.body;
  const result = await createJobTitleService(organizationId, userId, title);
  return ApiResponse.success(res, 'Job title created successfully', result, 201);
};

export const updateJobTitle = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;
  const { title } = req.body;
  const result = await updateJobTitleService(organizationId, id, title);
  return ApiResponse.success(res, 'Job title updated successfully', result, 200);
};

export const deleteJobTitle = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { id } = req.params;
  const result = await deleteJobTitleService(organizationId, id);
  return ApiResponse.success(res, 'Job title deleted successfully', result, 200);
};

export const assignJobTitle = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);
  const { userId, title } = req.body;
  const result = await assignJobTitleService(organizationId, userId, title);
  return ApiResponse.success(res, 'Job title assigned successfully', result, 200);
};
