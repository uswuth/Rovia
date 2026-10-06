import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { UserClass } from './user.model.js';
import { OrganizationClass } from './organization.model.js';

export type SummaryStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

/** Explicit subdocument: Typegoose cannot infer inline array element shapes. */
@modelOptions({ schemaOptions: { _id: false } })
export class SummaryActionItemClass {
  @prop({ type: () => String, required: true })
  public text!: string;

  /** Only populated when the transcript actually names someone. */
  @prop({ type: () => String, default: null })
  public assignee?: string | null;
}

@modelOptions({
  schemaOptions: {
    collection: 'summaries',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          summaryId: (ret._id as { toString(): string })?.toString(),
          summaryStatus: ret.summary_status as string,
          summaryText: ret.summary_text as string,
          summaryKeyPoints: (ret.summary_key_points as string[]) || [],
          summaryActionItems: (ret.summary_action_items as unknown[]) || [],
          organizationId: ret.organization_id,
          recordingId: ret.recording_id,
          transcriptId: ret.transcript_id,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class SummaryClass {
  @prop({ ref: () => 'OrganizationClass', required: true, index: true, alias: 'organizationId' })
  public organization_id!: Ref<OrganizationClass>;

  public get organizationId(): Ref<OrganizationClass> {
    return this.organization_id;
  }
  public set organizationId(val: Ref<OrganizationClass>) {
    this.organization_id = val;
  }

  @prop({ ref: () => 'RecordingClass', required: true, index: true, alias: 'recordingId' })
  public recording_id!: Ref<'RecordingClass'>;

  public get recordingId(): Ref<'RecordingClass'> {
    return this.recording_id;
  }
  public set recordingId(val: Ref<'RecordingClass'>) {
    this.recording_id = val;
  }

  @prop({ ref: () => 'TranscriptClass', required: true, index: true, alias: 'transcriptId' })
  public transcript_id!: Ref<'TranscriptClass'>;

  public get transcriptId(): Ref<'TranscriptClass'> {
    return this.transcript_id;
  }
  public set transcriptId(val: Ref<'TranscriptClass'>) {
    this.transcript_id = val;
  }

  @prop({ type: () => String, default: '', alias: 'createdBy' })
  public created_by?: Ref<UserClass>;

  public get createdBy(): Ref<UserClass> | undefined {
    return this.created_by;
  }
  public set createdBy(val: Ref<UserClass> | undefined) {
    this.created_by = val;
  }

  @prop({
    type: () => String,
    enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'],
    default: 'PENDING',
    index: true,
    alias: 'summaryStatus'
  })
  public summary_status!: SummaryStatus;

  public get summaryStatus(): SummaryStatus {
    return this.summary_status;
  }
  public set summaryStatus(val: SummaryStatus) {
    this.summary_status = val;
  }

  @prop({ type: () => String, default: '', alias: 'summaryText' })
  public summary_text!: string;

  public get summaryText(): string {
    return this.summary_text;
  }
  public set summaryText(val: string) {
    this.summary_text = val;
  }

  @prop({ type: () => [String], default: [], alias: 'summaryKeyPoints' })
  public summary_key_points!: string[];

  public get summaryKeyPoints(): string[] {
    return this.summary_key_points;
  }
  public set summaryKeyPoints(val: string[]) {
    this.summary_key_points = val;
  }

  @prop({ type: () => [SummaryActionItemClass], default: [], alias: 'summaryActionItems' })
  public summary_action_items!: Array<SummaryActionItemClass>;

  public get summaryActionItems(): Array<{ text: string; assignee?: string | null }> {
    return this.summary_action_items;
  }
  public set summaryActionItems(val: Array<{ text: string; assignee?: string | null }>) {
    this.summary_action_items = val;
  }

  public get summaryId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type SummaryDocument = DocumentType<SummaryClass>;
export const Summary = getModelForClass(SummaryClass);
