import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  refreshTokenCookieOptions,
  clearRefreshTokenCookieOptions
} from '../config/cookies.js';
import { getRequestScope } from '../utils/scope.js';
import {
  registerUserService,
  loginUserService,
  refreshAccessTokenService,
  logoutUserService,
  getCurrentUserService,
  changePasswordService
} from '../services/auth.service.js';

export const registerUser = async (req: Request, res: Response): Promise<Response> => {
  const { user, accessToken, refreshToken } = await registerUserService(req.body);

  // Same cookie contract as login: the refresh token lives only in the
  // httpOnly cookie, never in the response body.
  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  return ApiResponse.success(
    res,
    'User registered successfully',
    { user, accessToken },
    201
  );
};

export const loginUser = async (req: Request, res: Response): Promise<Response> => {
  const { user, accessToken, refreshToken } = await loginUserService(req.body);

  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  return ApiResponse.success(
    res,
    'Login successful',
    { user, accessToken },
    200
  );
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<Response> => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  const { accessToken, newRefreshToken } = await refreshAccessTokenService(incomingRefreshToken);

  res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);

  return ApiResponse.success(
    res,
    'Access token refreshed successfully',
    { accessToken },
    200
  );
};

export const logoutUser = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  await logoutUserService(userId);

  res.clearCookie('refreshToken', clearRefreshTokenCookieOptions);

  return ApiResponse.success(res, 'Logged out successfully', null, 200);
};

export const getCurrentUser = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  const user = await getCurrentUserService(userId);

  return ApiResponse.success(res, 'Current user profile retrieved', user, 200);
};

export const changePassword = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = getRequestScope(req);
  await changePasswordService(userId, req.body);

  return ApiResponse.success(res, 'Password changed successfully', null, 200);
};
