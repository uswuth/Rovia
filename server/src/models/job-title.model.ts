import { prop, getModelForClass, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { OrganizationClass } from './organization.model.js';
import { UserClass } from './user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'job_titles',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          id: (ret._id as { toString(): string })?.toString(),
          title: ret.title as string,
          organizationId: ret.organization_id,
          createdBy: ret.created_by,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at,
        };
      },
    },
    toObject: { virtuals: true },
  },
  options: { allowMixed: Severity.ALLOW },
})
export class JobTitleClass {
  @prop({
    type: () => String,
    required: [true, 'Job title is required'],
    trim: true,
    minlength: [2, 'Job title must be at least 2 characters'],
  })
  public title!: string;

  @prop({ ref: () => 'OrganizationClass', required: true, index: true, alias: 'organizationId' })
  public organization_id!: Ref<OrganizationClass>;

  @prop({ ref: () => 'UserClass', required: true, alias: 'createdBy' })
  public created_by!: Ref<UserClass>;
}

export const JobTitleModel = getModelForClass(JobTitleClass);
