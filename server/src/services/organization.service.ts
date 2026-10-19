import { Organization, OrganizationClass } from '../models/organization.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { Ref } from '@typegoose/typegoose';
import { findPaginated } from '../utils/paginatedFind.js';
import { requireOrganizationId } from '../utils/scope.js';
import { ORGANIZATION_OWNER_POPULATE, USER_LIST_SELECT } from '../utils/projections.js';
import { generateSequentialCode, ENTITY_PREFIXES } from '../utils/codeGenerator.js';

export const getMyOrganizationService = async (orgId: string) => {
  requireOrganizationId(orgId, 'view this organization');

  const org = await Organization.findById(orgId).populate(
    'organization_owner_id',
    ORGANIZATION_OWNER_POPULATE
  );
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  return org;
};

export const getOrganizationMembersService = async (
  orgId: string,
  query: Record<string, unknown> = {}
) => {
  requireOrganizationId(orgId, 'view organization members');

  // Ensure the primary organization owner is always synchronized as SuperAdmin
  const org = await Organization.findById(orgId).select('organization_owner_id');
  if (org?.organization_owner_id) {
    await User.updateOne(
      {
        _id: org.organization_owner_id,
        $or: [{ user_role: { $ne: 'SuperAdmin' } }, { is_super_admin: { $ne: true } }]
      },
      { $set: { user_role: 'SuperAdmin', is_super_admin: true } }
    );
  }

  const filter: Record<string, unknown> = { organization_id: orgId, is_deleted: { $ne: true } };
  if (typeof query.userCode === 'string' && query.userCode.trim()) {
    filter.user_code = query.userCode.trim();
  }
  if (typeof query.userId === 'string' && query.userId.trim()) {
    filter._id = query.userId.trim();
  }

  return findPaginated(User, filter, query, {
    sort: { created_at: -1 },
    select: USER_LIST_SELECT
  });
};

export const getOrganizationMemberByIdService = async (
  orgId: string,
  memberId: string,
  requester?: { userId?: string; userRole?: string; isSuperAdmin?: boolean }
) => {
  requireOrganizationId(orgId, 'view organization member profile');

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(memberId);
  const filter: Record<string, unknown> = {
    organization_id: orgId,
    is_deleted: { $ne: true },
    $or: isObjectId
      ? [{ _id: memberId }, { user_code: memberId }, { user_code: memberId.toUpperCase() }]
      : [{ user_code: memberId }, { user_code: memberId.toUpperCase() }]
  };

  const isSelfOrAdmin = Boolean(
    requester?.isSuperAdmin ||
    requester?.userRole === 'Admin' ||
    (requester?.userId && (filter._id === requester.userId || (isObjectId && memberId === requester.userId)))
  );

  const query = User.findOne(filter);
  if (!isSelfOrAdmin) {
    query.select(USER_LIST_SELECT);
  }

  const member = await query;
  if (!member) {
    throw ApiError.notFound('Member not found in your organization');
  }

  if (!isSelfOrAdmin && requester?.userId && member._id.toString() === requester.userId) {
    const selfMember = await User.findById(member._id);
    if (selfMember) return selfMember;
  }

  return member;
};

export const createOrganizationByAdminService = async (
  input: { organizationName: string; organizationLocation?: string; organizationDescription?: string },
  adminUserId: string
) => {
  const { organizationName, organizationLocation, organizationDescription } = input;
  if (!organizationName || !organizationName.trim()) {
    throw ApiError.badRequest('Organization name is required', [
      { field: 'organizationName', message: 'Organization name is required' }
    ]);
  }

  const baseSlug = organizationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org';
  const existingOrg = await Organization.findOne({ organization_slug: baseSlug });
  const finalSlug = existingOrg ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const org = await Organization.create({
    organization_name: organizationName.trim(),
    organization_slug: finalSlug,
    organization_location: organizationLocation?.trim() || '',
    organization_description: organizationDescription?.trim() || '',
    organization_owner_id: adminUserId
  });

  return org;
};

export const getAllOrganizationsAdminService = async () => {
  const orgs = await Organization.find()
    .populate('organization_owner_id', 'user_name user_email user_role')
    .sort({ created_at: -1 });

  const orgsWithCount = await Promise.all(
    orgs.map(async (org) => {
      const memberCount = await User.countDocuments({ organization_id: org._id, is_deleted: { $ne: true } });
      const plain = org.toJSON();
      return {
        ...plain,
        memberCount
      };
    })
  );

  return orgsWithCount;
};

export const provisionUserService = async (input: {
  userName: string;
  userEmail: string;
  password?: string;
  organizationId: string;
  userRole?: string;
  userStatus?: string;
  jobTitle?: string;
}) => {
  const { userName, userEmail, password, organizationId, userRole, userStatus, jobTitle } = input;

  if (!userName || !userName.trim()) {
    throw ApiError.badRequest('User name is required');
  }
  if (!userEmail || !userEmail.trim()) {
    throw ApiError.badRequest('User email is required');
  }
  if (!organizationId) {
    throw ApiError.badRequest('Target Organization is required');
  }

  const org = await Organization.findById(organizationId);
  if (!org) {
    throw ApiError.notFound('Target Organization not found');
  }

  const existingUser = await User.findOne({ user_email: userEmail.trim().toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('A user with this email address already exists');
  }

  const defaultPassword = password && password.length >= 6 ? password : 'User@123456';
  // Privilege Escalation Guard: Only 'Admin' or 'Member' can ever be provisioned
  const roleToAssign = userRole === 'Admin' ? 'Admin' : 'Member';
  const statusToAssign = (userStatus as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') || 'ACTIVE';
  const userCode = await generateSequentialCode(ENTITY_PREFIXES.USER, User, 'user_code');

  const newUser = await User.create({
    user_name: userName.trim(),
    user_email: userEmail.trim().toLowerCase(),
    password: defaultPassword,
    organization_id: org._id,
    user_role: roleToAssign,
    user_status: statusToAssign,
    is_super_admin: false,
    job_title: jobTitle?.trim() || 'Team Member',
    user_code: userCode
  });

  return {
    userId: newUser._id.toString(),
    userName: newUser.user_name,
    userEmail: newUser.user_email,
    userRole: newUser.user_role,
    userStatus: newUser.user_status,
    organizationId: org._id.toString(),
    organizationName: org.organization_name,
    userCode: newUser.user_code,
    jobTitle: newUser.job_title,
    initialPassword: defaultPassword
  };
};

export const updateUserService = async (
  userId: string,
  input: {
    userName?: string;
    userEmail?: string;
    userRole?: string;
    userStatus?: string;
    jobTitle?: string;
    organizationId?: string;
  }
) => {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) {
    throw ApiError.notFound('User not found');
  }

  if (input.userName !== undefined && input.userName.trim() !== '') {
    user.user_name = input.userName.trim();
  }

  const org = await Organization.findById(user.organization_id);
  const isOrgOwner = Boolean(
    org &&
    org.organization_owner_id &&
    org.organization_owner_id.toString() === user._id.toString()
  );

  if (isOrgOwner) {
    // Org owner is permanently SuperAdmin and ACTIVE
    user.user_role = 'SuperAdmin';
    user.is_super_admin = true;
    user.user_status = 'ACTIVE';
  } else {
    if (input.userRole !== undefined) {
      // Privilege Escalation Guard: Non-owners can only ever be assigned Admin or Member
      const validRole = input.userRole === 'Admin' ? 'Admin' : 'Member';
      user.user_role = validRole;
      user.is_super_admin = false;
    }

    if (input.userStatus !== undefined) {
      user.user_status = input.userStatus as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    }
  }

  if (input.jobTitle !== undefined) {
    user.job_title = input.jobTitle.trim();
  }

  if (input.organizationId !== undefined && input.organizationId.trim() !== '') {
    const org = await Organization.findById(input.organizationId);
    if (!org) {
      throw ApiError.notFound('Specified Organization not found');
    }
    user.organization_id = org._id as Ref<OrganizationClass>;
  }

  await user.save();

  const populatedUser = await User.findById(user._id)
    .populate('organization_id', 'organization_name organization_slug organization_location')
    .select('-password -refresh_token');

  return populatedUser;
};

export const getAllUsersAdminService = async (orgIdFilter?: string) => {
  const query: Record<string, unknown> = { is_deleted: { $ne: true } };
  if (orgIdFilter) {
    query.organization_id = orgIdFilter;
  }
  const users = await User.find(query)
    .populate('organization_id', 'organization_name organization_slug organization_location')
    .sort({ created_at: -1 })
    .select('-password -refresh_token');

  return users;
};


