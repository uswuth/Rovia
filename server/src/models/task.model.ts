import { prop, getModelForClass, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { UserClass } from './user.model.js';
import { ProjectClass } from './project.model.js';
import { TeamClass } from './team.model.js';
import { OrganizationClass } from './organization.model.js';

export type TaskStatus = 'to_do' | 'in_progress' | 'bug' | 'backlog' | 'completed';

@modelOptions({
  schemaOptions: {
    collection: 'tasks',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          taskId: (ret._id as { toString(): string })?.toString(),
          taskTitle: ret.task_title as string,
          taskDescription: (ret.task_description ?? '') as string,
          taskStatus: (ret.task_status ?? 'to_do') as string,
          assignedMembers: (ret.assigned_members as string[]) || [],
          projectId: ret.project_id,
          teamId: ret.team_id,
          organizationId: ret.organization_id,
          createdBy: ret.created_by,
          updatedBy: ret.updated_by,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class TaskClass {
  @prop({ type: () => String, required: true, trim: true })
  public task_title!: string;

  @prop({ type: () => String, default: '' })
  public task_description?: string;

  @prop({
    type: () => String,
    enum: ['to_do', 'in_progress', 'bug', 'backlog', 'completed'],
    default: 'to_do',
    index: true
  })
  public task_status!: TaskStatus;

  @prop({ ref: () => UserClass, type: () => [Types.ObjectId], default: [] })
  public assigned_members!: Ref<UserClass>[];

  @prop({ ref: () => 'ProjectClass', index: true })
  public project_id?: Ref<ProjectClass>;

  @prop({ ref: () => 'TeamClass', index: true })
  public team_id?: Ref<TeamClass>;

  @prop({ ref: () => 'OrganizationClass', required: true, index: true })
  public organization_id!: Ref<OrganizationClass>;

  @prop({ ref: () => UserClass, index: true })
  public created_by?: Ref<UserClass>;

  @prop({ ref: () => UserClass })
  public updated_by?: Ref<UserClass>;
}

export const Task = getModelForClass(TaskClass);
