import { JobTitleModel } from '../models/job-title.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { requireOrganizationId } from '../utils/scope.js';

export const listJobTitlesService = async (orgId: string) => {
  requireOrganizationId(orgId, 'list job titles');
  return JobTitleModel.find({ organization_id: orgId }).sort({ title: 1 });
};

export const createJobTitleService = async (orgId: string, userId: string, title: string) => {
  requireOrganizationId(orgId, 'create a job title');
  const cleanTitle = (title || '').trim();
  if (!cleanTitle || cleanTitle.length < 2) {
    throw ApiError.badRequest('Job title must be at least 2 characters long');
  }

  const existing = await JobTitleModel.findOne({
    organization_id: orgId,
    title: { $regex: new RegExp(`^${cleanTitle}$`, 'i') },
  });
  if (existing) {
    throw ApiError.badRequest(`Job title "${cleanTitle}" already exists in this organization`);
  }

  const created = await JobTitleModel.create({
    title: cleanTitle,
    organization_id: orgId,
    created_by: userId,
  });

  return created;
};

export const updateJobTitleService = async (orgId: string, jobTitleId: string, title: string) => {
  requireOrganizationId(orgId, 'update a job title');
  const cleanTitle = (title || '').trim();
  if (!cleanTitle || cleanTitle.length < 2) {
    throw ApiError.badRequest('Job title must be at least 2 characters long');
  }

  const jobTitle = await JobTitleModel.findOne({ _id: jobTitleId, organization_id: orgId });
  if (!jobTitle) {
    throw ApiError.notFound('Job title not found');
  }

  const existing = await JobTitleModel.findOne({
    organization_id: orgId,
    _id: { $ne: jobTitleId },
    title: { $regex: new RegExp(`^${cleanTitle}$`, 'i') },
  });
  if (existing) {
    throw ApiError.badRequest(`Another job title "${cleanTitle}" already exists`);
  }

  jobTitle.title = cleanTitle;
  await jobTitle.save();

  return jobTitle;
};

export const deleteJobTitleService = async (orgId: string, jobTitleId: string) => {
  requireOrganizationId(orgId, 'delete a job title');
  const jobTitle = await JobTitleModel.findOneAndDelete({ _id: jobTitleId, organization_id: orgId });
  if (!jobTitle) {
    throw ApiError.notFound('Job title not found');
  }
  return { message: 'Job title removed successfully', id: jobTitleId };
};

export const assignJobTitleService = async (orgId: string, targetUserId: string, title: string) => {
  requireOrganizationId(orgId, 'assign a job title');
  const user = await User.findOne({ _id: targetUserId, organization_id: orgId });
  if (!user) {
    throw ApiError.notFound('Member not found in this organization');
  }

  user.job_title = (title || '').trim();
  await user.save();

  return user;
};
