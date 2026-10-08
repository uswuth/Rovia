import { prop, getModelForClass, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { OrganizationClass } from './organization.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'work_roles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          roleId: (ret._id as { toString(): string })?.toString(),
          roleCode: (ret.role_code ?? '') as string,
          roleName: ret.role_name as string,
          tagName: (ret.tag_name ?? '') as string,
          description: (ret.description ?? '') as string,
          organizationId: ret.organization_id,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class WorkRoleClass {
  @prop({ type: () => String, required: true, trim: true, index: true })
  public role_code!: string;

  @prop({ type: () => String, required: true, trim: true })
  public role_name!: string;

  @prop({ type: () => String, default: '', trim: true })
  public tag_name?: string;

  @prop({ type: () => String, default: '', trim: true })
  public description?: string;

  @prop({ ref: () => 'OrganizationClass', required: true, index: true })
  public organization_id!: Ref<OrganizationClass>;
}

export const WorkRole = getModelForClass(WorkRoleClass);
