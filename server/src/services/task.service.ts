import { Task, TaskStatus } from '../models/task.model.js';
import { ApiError } from '../utils/apiError.js';
import { Ref } from '@typegoose/typegoose';
import { UserClass } from '../models/user.model.js';
import { ProjectClass } from '../models/project.model.js';
import { TeamClass } from '../models/team.model.js';

export const createTaskService = async (input: {
  taskTitle: string;
  taskDescription?: string;
  taskStatus?: TaskStatus;
  assignedMembers?: string[];
  projectId?: string;
  teamId?: string;
  organizationId: string;
  userId: string;
}) => {
  const { taskTitle, taskDescription, taskStatus, assignedMembers = [], projectId, teamId, organizationId, userId } = input;

  if (!taskTitle || !taskTitle.trim()) {
    throw ApiError.badRequest('Task title is required');
  }

  const task = await Task.create({
    task_title: taskTitle.trim(),
    task_description: taskDescription || '',
    task_status: taskStatus || 'to_do',
    assigned_members: assignedMembers as unknown as Ref<UserClass>[],
    project_id: projectId ? (projectId as unknown as Ref<ProjectClass>) : undefined,
    team_id: teamId ? (teamId as unknown as Ref<TeamClass>) : undefined,
    organization_id: organizationId,
    created_by: userId as unknown as Ref<UserClass>,
    updated_by: userId as unknown as Ref<UserClass>
  });

  const populated = await Task.findById(task._id)
    .populate('project_id', 'project_name project_code')
    .populate('team_id', 'team_name team_code')
    .populate('assigned_members', 'user_name user_email user_role avatar_url job_title')
    .populate('created_by', 'user_name user_email');

  return populated;
};

export const getTasksByOrgService = async (
  organizationId: string,
  filters?: { projectId?: string; teamId?: string; status?: string }
) => {
  if (!organizationId) return [];
  const query: Record<string, unknown> = { organization_id: organizationId };
  if (filters?.projectId) query.project_id = filters.projectId;
  if (filters?.teamId) query.team_id = filters.teamId;
  if (filters?.status) query.task_status = filters.status;

  const tasks = await Task.find(query)
    .populate('project_id', 'project_name project_code')
    .populate('team_id', 'team_name team_code')
    .populate('assigned_members', 'user_name user_email user_role avatar_url job_title user_code')
    .populate('created_by', 'user_name user_email')
    .populate('updated_by', 'user_name user_email')
    .sort({ created_at: -1 });

  return tasks;
};

export const getTaskByIdService = async (taskId: string, organizationId: string) => {
  const task = await Task.findOne({ _id: taskId, organization_id: organizationId })
    .populate('project_id', 'project_name project_code')
    .populate('team_id', 'team_name team_code')
    .populate('assigned_members', 'user_name user_email user_role avatar_url job_title user_code')
    .populate('created_by', 'user_name user_email')
    .populate('updated_by', 'user_name user_email');

  if (!task) {
    throw ApiError.notFound('Task not found');
  }
  return task;
};

export const updateTaskService = async (
  taskId: string,
  organizationId: string,
  userId: string,
  input: {
    taskTitle?: string;
    taskDescription?: string;
    taskStatus?: TaskStatus;
    assignedMembers?: string[];
    projectId?: string;
    teamId?: string;
  }
) => {
  const task = await Task.findOne({ _id: taskId, organization_id: organizationId });
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  if (input.taskTitle) task.task_title = input.taskTitle.trim();
  if (input.taskDescription !== undefined) task.task_description = input.taskDescription;
  if (input.taskStatus) task.task_status = input.taskStatus;
  if (input.assignedMembers !== undefined) task.assigned_members = input.assignedMembers as unknown as Ref<UserClass>[];
  if (input.projectId !== undefined) task.project_id = input.projectId as unknown as Ref<ProjectClass>;
  if (input.teamId !== undefined) task.team_id = input.teamId as unknown as Ref<TeamClass>;

  task.updated_by = userId as unknown as Ref<UserClass>;
  await task.save();

  const updated = await Task.findById(task._id)
    .populate('project_id', 'project_name project_code')
    .populate('team_id', 'team_name team_code')
    .populate('assigned_members', 'user_name user_email user_role avatar_url job_title')
    .populate('created_by', 'user_name user_email')
    .populate('updated_by', 'user_name user_email');

  return updated;
};

export const deleteTaskService = async (taskId: string, organizationId: string) => {
  const task = await Task.findOne({ _id: taskId, organization_id: organizationId });
  if (!task) {
    throw ApiError.notFound('Task not found');
  }
  await Task.deleteOne({ _id: taskId });
  return { message: 'Task deleted successfully' };
};
