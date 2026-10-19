import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  getUserDetailsService,
  updateOrCreateUserDetailsService
} from '../services/user-details.service.js';

export const getUserDetails = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  const data = await getUserDetailsService(userId);
  return ApiResponse.success(res, 'User details retrieved successfully', data, 200);
};

export const updateUserDetails = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  const data = await updateOrCreateUserDetailsService(userId, req.body);
  return ApiResponse.success(res, 'User details updated successfully', data, 200);
};
