import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { Organization } from '../models/organization.model.js';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { generateSequentialCode, ENTITY_PREFIXES } from '../utils/codeGenerator.js';
import { validateRequired } from '../utils/validation.js';
import { ORGANIZATION_POPULATE } from '../utils/projections.js';
import {
  IUserRegisterInput,
  IUserLoginInput,
  IAuthTokensResponse
} from '../types/index.js';

export const registerUserService = async (
  input: IUserRegisterInput
): Promise<IAuthTokensResponse & { refreshToken: string }> => {
  validateRequired(input, ['userName', 'userEmail', 'password']);

  const userName = input.userName.trim();
  const userEmail = input.userEmail.toLowerCase().trim();
  const password = input.password;

  const existingUser = await User.findOne({ user_email: userEmail });
  if (existingUser) {
    throw ApiError.badRequest('User with this email already exists', [
      { field: 'userEmail', message: 'User with this email already exists' }
    ]);
  }

  const isCreatingOrg = Boolean(input.isCreatingOrg);
  const avatarUrl = input.avatarUrl || '';

  let assignedOrgId: string | undefined;

  if (isCreatingOrg) {
    // ── CASE 1: Toggle = TRUE (Creating Organization -> SuperAdmin) ──
    const orgName = (input.organizationName || '').trim();
    if (!orgName) {
      throw ApiError.badRequest('Organization name is required when creating an organization', [
        { field: 'organizationName', message: 'Organization name is required' }
      ]);
    }

    const baseSlug = (input.organizationSlug || orgName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-');

    // Collision handling: try a random suffix, then a timestamp suffix, so a
    // repeated collision can never surface as a raw duplicate-key 500.
    const slugExists = async (slug: string) =>
      Boolean(await Organization.findOne({ organization_slug: slug }).lean());
    let finalSlug = baseSlug;
    if (await slugExists(finalSlug)) {
      finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
      if (await slugExists(finalSlug)) {
        finalSlug = `${baseSlug}-${Date.now().toString(36)}`;
      }
    }

    const userCode = await generateSequentialCode(ENTITY_PREFIXES.USER, User, 'user_code');
    const user = new User({
      user_name: userName,
      user_email: userEmail,
      password,
      user_role: 'SuperAdmin',
      is_super_admin: true,
      user_code: userCode,
      avatar_url: avatarUrl
    });

    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();

    // 2. Create Organization with user as owner. If this fails, the half-created
    // user is rolled back so a failed signup never consumes the email address.
    const newOrg = await Organization.create({
      organization_name: orgName,
      organization_slug: finalSlug,
      organization_location: input.organizationLocation ? input.organizationLocation.trim() : '',
      organization_owner_id: user._id
    }).catch(async (error: unknown) => {
      await User.deleteOne({ _id: user._id }).catch(() => undefined);
      throw error;
    });

    // 3. Link organization to user
    user.organization_id = newOrg._id;
    await user.save();

    // 4. Generate accessToken with organizationId included in the payload
    const accessToken = user.generateAccessToken();

    const populatedUser = await User.findById(user._id).populate('organization_id', ORGANIZATION_POPULATE);

    return {
      user: populatedUser!.toJSON() as unknown as IAuthTokensResponse['user'],
      accessToken,
      refreshToken
    };
  }

  if (input.organizationId) {
    assignedOrgId = input.organizationId;
  }

  const userCode = await generateSequentialCode(ENTITY_PREFIXES.USER, User, 'user_code');
  const user = new User({
    user_name: userName,
    user_email: userEmail,
    password,
    user_role: 'Member',
    is_super_admin: false,
    user_code: userCode,
    organization_id: assignedOrgId,
    avatar_url: avatarUrl
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save();

  const populatedUser = await User.findById(user._id).populate('organization_id', ORGANIZATION_POPULATE);

  return {
    user: populatedUser!.toJSON() as unknown as IAuthTokensResponse['user'],
    accessToken,
    refreshToken
  };
};

export const loginUserService = async (input: IUserLoginInput): Promise<IAuthTokensResponse & { refreshToken: string }> => {
  validateRequired(input, ['userEmail', 'password']);

  const userEmail = input.userEmail.toLowerCase().trim();
  const { password } = input;

  const user = await User.findOne({ user_email: userEmail }).select('+password +refreshToken');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save();

  const populatedUser = await User.findById(user._id).populate('organization_id', ORGANIZATION_POPULATE);

  return {
    user: populatedUser!.toJSON() as unknown as IAuthTokensResponse['user'],
    accessToken,
    refreshToken
  };
};

export const refreshAccessTokenService = async (incomingRefreshToken: string): Promise<{ accessToken: string; newRefreshToken: string }> => {
  if (!incomingRefreshToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  let decoded: { id: string };
  try {
    decoded = jwt.verify(incomingRefreshToken, env.JWT_REFRESH_SECRET) as { id: string };
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.refreshToken = newRefreshToken;
  await user.save();

  return {
    accessToken: newAccessToken,
    newRefreshToken
  };
};

export const logoutUserService = async (userId: string): Promise<void> => {
  if (userId) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  }
};

export const getCurrentUserService = async (userId: string): Promise<IAuthTokensResponse['user']> => {
  const user = await User.findById(userId).populate('organization_id', ORGANIZATION_POPULATE);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toJSON() as unknown as IAuthTokensResponse['user'];
};

export interface IChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordService = async (
  userId: string,
  input: IChangePasswordInput
): Promise<void> => {
  const { currentPassword, newPassword } = input;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw ApiError.badRequest('New password must be at least 6 characters long', [
      { field: 'newPassword', message: 'Password must be at least 6 characters' }
    ]);
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isCurrentValid = await user.comparePassword(currentPassword);
  if (!isCurrentValid) {
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' }
    ]);
  }

  user.password = newPassword;
  await user.save();
};
