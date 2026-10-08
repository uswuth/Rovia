import { prop, getModelForClass, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { UserClass } from './user.model.js';
import { ProjectClass } from './project.model.js';
import { OrganizationClass } from './organization.model.js';

export type TeamStatus = 'active' | 'completed' | 'archived';

@modelOptions({
  schemaOptions: {
    collection: 'teams',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          teamId: (ret._id as { toString(): string })?.toString(),
          teamName: ret.team_name as string,
          teamCode: (ret.team_code ?? '') as string,
          description: (ret.description ?? '') as string,
          projectId: ret.project_id,
          organizationId: ret.organization_id,
          hosts: (ret.team_hosts as string[]) || [],
          members: (ret.team_members as string[]) || [],
          teamStatus: (ret.team_status ?? 'active') as string,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class TeamClass {
  @prop({ type: () => String, required: true, trim: true })
  public team_name!: string;

  @prop({ type: () => String, default: '', index: true })
  public team_code?: string;

  @prop({ type: () => String, default: '', trim: true })
  public description?: string;

  @prop({ ref: () => 'ProjectClass', required: true, index: true })
  public project_id!: Ref<ProjectClass>;

  @prop({ ref: () => 'OrganizationClass', required: true, index: true })
  public organization_id!: Ref<OrganizationClass>;

  @prop({ ref: () => UserClass, type: () => [Types.ObjectId], default: [] })
  public team_hosts!: Ref<UserClass>[];

  @prop({ ref: () => UserClass, type: () => [Types.ObjectId], default: [] })
  public team_members!: Ref<UserClass>[];

  @prop({ type: () => String, enum: ['active', 'completed', 'archived'], default: 'active' })
  public team_status!: TeamStatus;
}

export const Team = getModelForClass(TeamClass);
