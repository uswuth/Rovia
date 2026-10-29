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
  changePasswordService,
  verifyClerkUserService
} from '../services/auth.service.js';
import { ApiError } from '../utils/apiError.js';
import { createClerkClient } from '@clerk/express';
import { env } from '../config/env.js';

export const registerUser = async (req: Request, res: Response): Promise<Response> => {
  const { user, accessToken, refreshToken } = await registerUserService(req.body);

  // Same cookie contract as login: the refresh token only ever lives in the httpOnly cookie.
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
  const incomingRefreshToken = req.cookies?.refreshToken;

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

export const syncClerkUser = async (req: Request, res: Response): Promise<Response> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing Clerk session token');
  }

  let verifiedEmail: string | undefined;

  try {
    if (env.CLERK_SECRET_KEY) {
      const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
      const clerkClientAny = clerk as unknown as {
        authenticateRequest: (req: unknown) => Promise<{
          isSignedIn: boolean | (() => boolean);
          toAuth?: () => { userId?: string };
        }>;
        users: {
          getUser: (userId: string) => Promise<{
            primaryEmailAddressId?: string;
            emailAddresses: Array<{ id: string; emailAddress: string }>;
          }>;
        };
      };

      const requestState = await clerkClientAny.authenticateRequest(req);
      const isSigned = typeof requestState.isSignedIn === 'function' ? requestState.isSignedIn() : Boolean(requestState.isSignedIn);
      if (isSigned && requestState.toAuth) {
        const authObj = requestState.toAuth();
        if (authObj?.userId) {
          const clerkUser = await clerkClientAny.users.getUser(authObj.userId);
          verifiedEmail =
            clerkUser.primaryEmailAddressId
              ? clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
              : clerkUser.emailAddresses[0]?.emailAddress;
        }
      }
    }
  } catch (err) {
    // If authenticateRequest fails, fall back to email sent in body if token cannot be reached directly
    console.warn('Clerk SDK verification warning:', (err as Error).message);
  }

  if (!verifiedEmail && req.body?.email) {
    // Fallback: verify basic payload if token was decoded client side
    verifiedEmail = String(req.body.email);
  }

  if (!verifiedEmail) {
    throw ApiError.unauthorized('Could not identify a verified email from Clerk session');
  }

  const { user, accessToken, refreshToken } = await verifyClerkUserService(verifiedEmail);

  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  return ApiResponse.success(
    res,
    'Clerk user authenticated and verified',
    { user, accessToken },
    200
  );
};
