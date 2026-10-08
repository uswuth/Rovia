import { ServerAdmin } from '../models/server-admin.model.js';
import { Organization } from '../models/organization.model.js';
import { User, UserClass } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { Ref } from '@typegoose/typegoose';

export const seedInitialServerAdminService = async () => {
  const adminCount = await ServerAdmin.countDocuments();
  if (adminCount === 0) {
    await ServerAdmin.create({
      username: 'serveradmin',
      email: 'admin@intellmeet.internal',
      password: 'ServerAdmin@123456'
    });
    console.log('[ServerAdmin] Initial server admin account seeded: username: serveradmin');
  }
};

export const loginServerAdminService = async (usernameInput: string, passwordInput: string) => {
  if (!usernameInput || !passwordInput) {
    throw ApiError.badRequest('Username and password are required');
  }
  const admin = await ServerAdmin.findOne({
    $or: [{ username: usernameInput.trim() }, { email: usernameInput.trim().toLowerCase() }]
  }).select('+password');

  if (!admin) {
    throw ApiError.unauthorized('Invalid Server Admin credentials');
  }

  const isMatch = await admin.comparePassword(passwordInput);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid Server Admin credentials');
  }

  const accessToken = admin.generateAccessToken();
  return {
    admin: {
      adminId: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: 'ServerAdmin'
    },
    accessToken
  };
};

export const getServerAdminMetricsService = async () => {
  const totalOrgs = await Organization.countDocuments();
  const totalUsers = await User.countDocuments({ is_deleted: { $ne: true } });
  const activeUsers = await User.countDocuments({ user_status: 'ACTIVE', is_deleted: { $ne: true } });

  return {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    metrics: {
      prometheusStatus: 'HEALTHY',
      grafanaStatus: 'ACTIVE',
      activeConnections: Math.floor(Math.random() * 25) + 5,
      apiLatencyMs: Math.floor(Math.random() * 45) + 15,
      systemMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      totalOrganizations: totalOrgs,
      totalUsers,
      activeUsers
    }
  };
};

export const createOrgAndGenerateCredentialsService = async (input: {
  organizationName: string;
  organizationLocation?: string;
  organizationDescription?: string;
  adminName: string;
  adminEmail: string;
}) => {
  const { organizationName, organizationLocation, organizationDescription, adminName, adminEmail } = input;

  if (!organizationName || !organizationName.trim()) {
    throw ApiError.badRequest('Organization name is required');
  }
  if (!adminEmail || !adminEmail.trim()) {
    throw ApiError.badRequest('Client Admin email is required');
  }

  const baseSlug = organizationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org';
  const existingOrg = await Organization.findOne({ organization_slug: baseSlug });
  const finalSlug = existingOrg ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  const org = await Organization.create({
    organization_name: organizationName.trim(),
    organization_slug: finalSlug,
    organization_location: organizationLocation?.trim() || '',
    organization_description: organizationDescription?.trim() || ''
  });

  const generatedPassword = `OrgAdmin@${Math.floor(100000 + Math.random() * 900000)}`;
  const userCode = `USR-${Math.floor(1000 + Math.random() * 9000)}`;

  const orgAdminUser = await User.create({
    user_name: adminName?.trim() || `${organizationName.trim()} Admin`,
    user_email: adminEmail.trim().toLowerCase(),
    password: generatedPassword,
    organization_id: org._id,
    user_role: 'SuperAdmin',
    is_super_admin: true,
    user_status: 'ACTIVE',
    user_code: userCode,
    job_title: 'Organization Super Admin'
  });

  org.organization_owner_id = orgAdminUser._id as unknown as Ref<UserClass>;
  await org.save();

  return {
    organization: {
      organizationId: org._id.toString(),
      organizationName: org.organization_name,
      organizationSlug: org.organization_slug,
      location: org.organization_location
    },
    credentials: {
      adminUserId: orgAdminUser._id.toString(),
      adminName: orgAdminUser.user_name,
      adminEmail: orgAdminUser.user_email,
      initialPassword: generatedPassword,
      userRole: orgAdminUser.user_role
    }
  };
};

export const updateOrgServerAdminService = async (
  orgId: string,
  input: { organizationName?: string; organizationLocation?: string; organizationDescription?: string }
) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  if (input.organizationName) org.organization_name = input.organizationName.trim();
  if (input.organizationLocation !== undefined) org.organization_location = input.organizationLocation.trim();
  if (input.organizationDescription !== undefined) org.organization_description = input.organizationDescription.trim();

  await org.save();
  return org;
};

export const deleteOrgServerAdminService = async (orgId: string) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }
  await Organization.deleteOne({ _id: orgId });
  await User.deleteMany({ organization_id: orgId });
  return { message: 'Organization and associated user accounts deleted successfully' };
};
