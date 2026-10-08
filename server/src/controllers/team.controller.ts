import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  createTeamService,
  getTeamsByOrgService,
  updateTeamService,
  deleteTeamService
} from '../services/team.service.js';

export const createTeam = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);

  const result = await createTeamService({
    ...req.body,
    organizationId: organizationId || req.body.organizationId
  });

  return ApiResponse.success(res, 'Team created successfully', result, 201);
};

export const getTeams = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId } = getRequestScope(req);

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;

  const result = await getTeamsByOrgService(organizationId, projectId);
  return ApiResponse.success(res, 'Teams retrieved successfully', result, 200);
};

export const updateTeam = async (req: Request, res: Response): Promise<Response> => {
  const { teamId } = req.params;
  const { organizationId } = getRequestScope(req);

  const result = await updateTeamService(teamId, organizationId, req.body);
  return ApiResponse.success(res, 'Team updated successfully', result, 200);
};

export const deleteTeam = async (req: Request, res: Response): Promise<Response> => {
  const { teamId } = req.params;
  const { organizationId } = getRequestScope(req);

  const result = await deleteTeamService(teamId, organizationId);
  return ApiResponse.success(res, result.message, null, 200);
};
