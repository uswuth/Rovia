import { Team, TeamStatus } from '../models/team.model.js';
import { Project } from '../models/project.model.js';
import { ApiError } from '../utils/apiError.js';
import { Ref } from '@typegoose/typegoose';
import { UserClass } from '../models/user.model.js';

export const createTeamService = async (input: {
  teamName: string;
  description?: string;
  projectId: string;
  organizationId: string;
  hosts?: string[];
  members?: string[];
  teamStatus?: TeamStatus;
}) => {
  const { teamName, description, projectId, organizationId, hosts = [], members = [], teamStatus } = input;

  if (!teamName || !teamName.trim()) {
    throw ApiError.badRequest('Team name is required');
  }
  if (!projectId) {
    throw ApiError.badRequest('Parent Project ID is required');
  }

  const project = await Project.findOne({ _id: projectId, organization_id: organizationId });
  if (!project) {
    throw ApiError.notFound('Parent project not found in this organization');
  }

  // Validate that all assigned team members & hosts belong to the parent project
  const projectMemberSet = new Set([
    ...project.project_hosts.map((id) => id.toString()),
    ...project.project_members.map((id) => id.toString())
  ]);

  const invalidMembers = members.filter((mId) => !projectMemberSet.has(mId.toString()));
  if (invalidMembers.length > 0) {
    throw ApiError.badRequest('Team members must be selected strictly from members assigned to the parent project');
  }

  const teamCode = `TM-${Math.floor(1000 + Math.random() * 9000)}`;

  const team = await Team.create({
    team_name: teamName.trim(),
    team_code: teamCode,
    description: description?.trim() || '',
    project_id: project._id,
    organization_id: organizationId,
    team_hosts: hosts as unknown as Ref<UserClass>[],
    team_members: members as unknown as Ref<UserClass>[],
    team_status: teamStatus || 'active'
  });

  const populated = await Team.findById(team._id)
    .populate('project_id', 'project_name project_code')
    .populate('team_hosts', 'user_name user_email user_role avatar_url job_title')
    .populate('team_members', 'user_name user_email user_role avatar_url job_title');

  return populated;
};

export const getTeamsByOrgService = async (organizationId: string, projectId?: string) => {
  if (!organizationId) return [];
  const query: Record<string, unknown> = { organization_id: organizationId };
  if (projectId) query.project_id = projectId;

  const teams = await Team.find(query)
    .populate('project_id', 'project_name project_code project_status')
    .populate('team_hosts', 'user_name user_email user_role avatar_url job_title user_code')
    .populate('team_members', 'user_name user_email user_role avatar_url job_title user_code')
    .sort({ created_at: -1 });

  return teams;
};

export const updateTeamService = async (
  teamId: string,
  organizationId: string,
  input: {
    teamName?: string;
    description?: string;
    hosts?: string[];
    members?: string[];
    teamStatus?: TeamStatus;
  }
) => {
  const team = await Team.findOne({ _id: teamId, organization_id: organizationId });
  if (!team) {
    throw ApiError.notFound('Team not found');
  }

  if (input.hosts || input.members) {
    const project = await Project.findById(team.project_id);
    if (project) {
      const projectMemberSet = new Set([
        ...project.project_hosts.map((id) => id.toString()),
        ...project.project_members.map((id) => id.toString())
      ]);
      const membersToCheck = input.members || team.team_members.map((m) => m.toString());
      const invalid = membersToCheck.filter((mId) => !projectMemberSet.has(mId.toString()));
      if (invalid.length > 0) {
        throw ApiError.badRequest('Team members must be selected strictly from members assigned to the parent project');
      }
    }
  }

  if (input.teamName) team.team_name = input.teamName.trim();
  if (input.description !== undefined) team.description = input.description.trim();
  if (input.hosts !== undefined) team.team_hosts = input.hosts as unknown as Ref<UserClass>[];
  if (input.members !== undefined) team.team_members = input.members as unknown as Ref<UserClass>[];
  if (input.teamStatus) team.team_status = input.teamStatus;

  await team.save();

  const updated = await Team.findById(team._id)
    .populate('project_id', 'project_name project_code')
    .populate('team_hosts', 'user_name user_email user_role avatar_url job_title')
    .populate('team_members', 'user_name user_email user_role avatar_url job_title');

  return updated;
};

export const deleteTeamService = async (teamId: string, organizationId: string) => {
  const team = await Team.findOne({ _id: teamId, organization_id: organizationId });
  if (!team) {
    throw ApiError.notFound('Team not found');
  }
  await Team.deleteOne({ _id: teamId });
  return { message: 'Team deleted successfully' };
};
