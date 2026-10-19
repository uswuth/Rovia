import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { UserClass } from './user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'user_details',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          id: (ret._id as { toString(): string })?.toString(),
          userId: ret.user_id ? (ret.user_id as { toString(): string }).toString() : undefined,
          phoneNumber: (ret.phone_number ?? '') as string,
          bloodType: (ret.blood_type ?? '') as string,
          address: (ret.address ?? '') as string,
          city: (ret.city ?? '') as string,
          state: (ret.state ?? '') as string,
          country: (ret.country ?? '') as string,
          postalCode: (ret.postal_code ?? '') as string,
          dateOfBirth: ret.date_of_birth ? (ret.date_of_birth as Date).toISOString() : null,
          gender: (ret.gender ?? '') as string,
          maritalStatus: (ret.marital_status ?? 'single') as string,
          spouseName: (ret.spouse_name ?? '') as string,
          bio: (ret.bio ?? '') as string,
          avatarUrl: (ret.avatar_url ?? '') as string,
          emergencyContactName: (ret.emergency_contact_name ?? '') as string,
          emergencyContactPhone: (ret.emergency_contact_phone ?? '') as string,
          emergencyContactRelation: (ret.emergency_contact_relation ?? '') as string,
          preferredLanguage: (ret.preferred_language ?? 'en') as string,
          timezone: (ret.timezone ?? '') as string,
          accentColor: (ret.accent_color ?? '#10b981') as string,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class UserDetailsClass {
  @prop({ ref: () => 'UserClass', required: true, unique: true, index: true, alias: 'userId' })
  public user_id!: Ref<UserClass>;

  @prop({ type: () => String, default: '', trim: true, alias: 'phoneNumber' })
  public phone_number?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'bloodType' })
  public blood_type?: string;

  @prop({ type: () => String, default: '', trim: true })
  public address?: string;

  @prop({ type: () => String, default: '', trim: true })
  public city?: string;

  @prop({ type: () => String, default: '', trim: true })
  public state?: string;

  @prop({ type: () => String, default: '', trim: true })
  public country?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'postalCode' })
  public postal_code?: string;

  @prop({ type: () => Date, default: null, alias: 'dateOfBirth' })
  public date_of_birth?: Date | null;

  @prop({ type: () => String, default: '', trim: true })
  public gender?: string;

  @prop({ type: () => String, default: 'single', trim: true, alias: 'maritalStatus' })
  public marital_status?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'spouseName' })
  public spouse_name?: string;

  @prop({ type: () => String, default: '', trim: true })
  public bio?: string;

  @prop({ type: () => String, default: '', alias: 'avatarUrl' })
  public avatar_url?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'emergencyContactName' })
  public emergency_contact_name?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'emergencyContactPhone' })
  public emergency_contact_phone?: string;

  @prop({ type: () => String, default: '', trim: true, alias: 'emergencyContactRelation' })
  public emergency_contact_relation?: string;

  @prop({ type: () => String, default: 'en', trim: true, alias: 'preferredLanguage' })
  public preferred_language?: string;

  @prop({ type: () => String, default: '', trim: true })
  public timezone?: string;

  @prop({ type: () => String, default: '#10b981', trim: true, alias: 'accentColor' })
  public accent_color?: string;
}

export type UserDetailsDocument = DocumentType<UserDetailsClass>;
export const UserDetails = getModelForClass(UserDetailsClass);
