import { WorkRole } from '../models/work-role.model.js';
import { ApiError } from '../utils/apiError.js';

export const createWorkRoleService = async (input: {
  roleName: string;
  tagName?: string;
  description?: string;
  organizationId: string;
}) => {
  const { roleName, tagName, description, organizationId } = input;
  if (!roleName || !roleName.trim()) {
    throw ApiError.badRequest('Role name is required');
  }
  if (!organizationId) {
    throw ApiError.badRequest('Organization ID is required');
  }

  const roleCode = `WR-${Math.floor(1000 + Math.random() * 9000)}`;
  const workRole = await WorkRole.create({
    role_name: roleName.trim(),
    role_code: roleCode,
    tag_name: tagName?.trim() || '',
    description: description?.trim() || '',
    organization_id: organizationId
  });

  return workRole;
};

export const getWorkRolesByOrgService = async (organizationId: string) => {
  if (!organizationId) return [];
  const roles = await WorkRole.find({ organization_id: organizationId }).sort({ created_at: -1 });
  return roles;
};

export const updateWorkRoleService = async (
  roleId: string,
  organizationId: string,
  input: { roleName?: string; tagName?: string; description?: string }
) => {
  const role = await WorkRole.findOne({ _id: roleId, organization_id: organizationId });
  if (!role) {
    throw ApiError.notFound('Work role not found');
  }

  if (input.roleName) role.role_name = input.roleName.trim();
  if (input.tagName !== undefined) role.tag_name = input.tagName.trim();
  if (input.description !== undefined) role.description = input.description.trim();

  await role.save();
  return role;
};

export const deleteWorkRoleService = async (roleId: string, organizationId: string) => {
  const role = await WorkRole.findOne({ _id: roleId, organization_id: organizationId });
  if (!role) {
    throw ApiError.notFound('Work role not found');
  }
  await WorkRole.deleteOne({ _id: roleId });
  return { message: 'Work role deleted successfully' };
};
