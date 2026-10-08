import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  createTaskService,
  getTasksByOrgService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService
} from '../services/task.service.js';

export const createTask = async (req: Request, res: Response): Promise<Response> => {
  const { userId, organizationId } = getRequestScope(req);

  const result = await createTaskService({
    ...req.body,
    organizationId: organizationId || req.body.organizationId,
    userId
  });

  return ApiResponse.success(res, 'Task created successfully', result, 201);
};

export const getTasks = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);

  const filters = {
    projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
    teamId: typeof req.query.teamId === 'string' ? req.query.teamId : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined
  };

  const result = await getTasksByOrgService(organizationId, filters);
  return ApiResponse.success(res, 'Tasks retrieved successfully', result, 200);
};

export const getTaskById = async (req: Request, res: Response): Promise<Response> => {
  const { taskId } = req.params;
  const { organizationId } = getRequestScope(req);

  const result = await getTaskByIdService(taskId, organizationId);
  return ApiResponse.success(res, 'Task retrieved successfully', result, 200);
};

export const updateTask = async (req: Request, res: Response): Promise<Response> => {
  const { taskId } = req.params;
  const { userId, organizationId } = getRequestScope(req);

  const result = await updateTaskService(taskId, organizationId, userId, req.body);
  return ApiResponse.success(res, 'Task updated successfully', result, 200);
};

export const deleteTask = async (req: Request, res: Response): Promise<Response> => {
  const { taskId } = req.params;
  const { organizationId } = getRequestScope(req);

  const result = await deleteTaskService(taskId, organizationId);
  return ApiResponse.success(res, result.message, null, 200);
};
