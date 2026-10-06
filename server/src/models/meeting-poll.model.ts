import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { OrganizationClass } from './organization.model.js';

export type MeetingPollStatus = 'OPEN' | 'CLOSED';

/** Explicit subdocument: Typegoose cannot infer inline array element shapes. */
@modelOptions({ schemaOptions: { _id: false } })
export class MeetingPollOptionClass {
  @prop({ type: () => String, required: true })
  public optionId!: string;

  @prop({ type: () => String, required: true })
  public optionText!: string;

  /** Internal only. The public toJSON exposes counts, never the voter list. */
  @prop({ type: () => [String], default: [] })
  public voterIds!: string[];
}

@modelOptions({
  schemaOptions: {
    collection: 'meeting_polls',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        const options = (ret.poll_options as Record<string, unknown>[]) || [];
        return {
          pollId: (ret._id as { toString(): string })?.toString(),
          pollQuestion: ret.poll_question as string,
          pollStatus: ret.poll_status as string,
          pollMultipleChoice: ret.poll_multiple_choice,
          // Vote counts only. The list of voter ids is never exposed publicly.
          pollOptions: options.map((option) => ({
            optionId: option.optionId,
            optionText: option.optionText,
            voteCount: ((option.voterIds as string[]) ?? []).length
          })),
          organizationId: ret.organization_id,
          meetingId: ret.meeting_id,
          createdBy: ret.created_by,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class MeetingPollClass {
  @prop({ ref: () => 'OrganizationClass', required: true, index: true, alias: 'organizationId' })
  public organization_id!: Ref<OrganizationClass>;

  public get organizationId(): Ref<OrganizationClass> {
    return this.organization_id;
  }
  public set organizationId(val: Ref<OrganizationClass>) {
    this.organization_id = val;
  }

  @prop({ ref: () => 'MeetingClass', required: true, index: true, alias: 'meetingId' })
  public meeting_id!: Ref<'MeetingClass'>;

  public get meetingId(): Ref<'MeetingClass'> {
    return this.meeting_id;
  }
  public set meetingId(val: Ref<'MeetingClass'>) {
    this.meeting_id = val;
  }

  @prop({ type: () => String, required: true, trim: true, alias: 'pollQuestion' })
  public poll_question!: string;

  public get pollQuestion(): string {
    return this.poll_question;
  }
  public set pollQuestion(val: string) {
    this.poll_question = val;
  }

  @prop({
    type: () => String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN',
    index: true,
    alias: 'pollStatus'
  })
  public poll_status!: MeetingPollStatus;

  public get pollStatus(): MeetingPollStatus {
    return this.poll_status;
  }
  public set pollStatus(val: MeetingPollStatus) {
    this.poll_status = val;
  }

  @prop({ type: () => Boolean, default: false, alias: 'pollMultipleChoice' })
  public poll_multiple_choice!: boolean;

  public get pollMultipleChoice(): boolean {
    return this.poll_multiple_choice;
  }
  public set pollMultipleChoice(val: boolean) {
    this.poll_multiple_choice = val;
  }

  @prop({ type: () => [MeetingPollOptionClass], default: [], alias: 'pollOptions' })
  public poll_options!: Array<MeetingPollOptionClass>;

  public get pollOptions(): Array<MeetingPollOptionClass> {
    return this.poll_options;
  }
  public set pollOptions(val: Array<MeetingPollOptionClass>) {
    this.poll_options = val;
  }

  @prop({ type: () => String, required: true, index: true, alias: 'createdBy' })
  public created_by!: string;

  public get createdBy(): string {
    return this.created_by;
  }
  public set createdBy(val: string) {
    this.created_by = val;
  }

  public get pollId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type MeetingPollDocument = DocumentType<MeetingPollClass>;
export const MeetingPoll = getModelForClass(MeetingPollClass);
