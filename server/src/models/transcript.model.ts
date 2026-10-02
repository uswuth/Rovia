import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { UserClass } from './user.model.js';
import { OrganizationClass } from './organization.model.js';

export type TranscriptStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

/** Explicit subdocument: Typegoose cannot infer inline array element shapes. */
@modelOptions({ schemaOptions: { _id: false } })
export class TranscriptSegmentClass {
  @prop({ type: () => Number, required: true })
  public startMs!: number;

  @prop({ type: () => Number, required: true })
  public endMs!: number;

  @prop({ type: () => String, required: true })
  public text!: string;
}

@modelOptions({
  schemaOptions: {
    collection: 'transcripts',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          transcriptId: (ret._id as { toString(): string })?.toString(),
          transcriptStatus: ret.transcript_status as string,
          transcriptText: ret.transcript_text as string,
          transcriptLanguage: ret.transcript_language ?? null,
          transcriptDurationMs: ret.transcript_duration_ms ?? 0,
          transcriptSegmentCount: ((ret.transcript_segments as unknown[]) ?? []).length,
          organizationId: ret.organization_id,
          recordingId: ret.recording_id,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class TranscriptClass {
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
    alias: 'transcriptStatus'
  })
  public transcript_status!: TranscriptStatus;

  public get transcriptStatus(): TranscriptStatus {
    return this.transcript_status;
  }
  public set transcriptStatus(val: TranscriptStatus) {
    this.transcript_status = val;
  }

  @prop({ type: () => String, default: '', alias: 'transcriptText' })
  public transcript_text!: string;

  public get transcriptText(): string {
    return this.transcript_text;
  }
  public set transcriptText(val: string) {
    this.transcript_text = val;
  }

  /** Null when the local model did not report one. Never forced to a value. */
  @prop({ type: () => String, default: null, alias: 'transcriptLanguage' })
  public transcript_language?: string | null;

  public get transcriptLanguage(): string | null {
    return this.transcript_language ?? null;
  }
  public set transcriptLanguage(val: string | null) {
    this.transcript_language = val;
  }

  @prop({ type: () => Number, default: 0, alias: 'transcriptDurationMs' })
  public transcript_duration_ms!: number;

  public get transcriptDurationMs(): number {
    return this.transcript_duration_ms;
  }
  public set transcriptDurationMs(val: number) {
    this.transcript_duration_ms = val;
  }

  @prop({ type: () => [TranscriptSegmentClass], default: [], alias: 'transcriptSegments' })
  public transcript_segments!: Array<TranscriptSegmentClass>;

  public get transcriptSegments(): Array<{ startMs: number; endMs: number; text: string }> {
    return this.transcript_segments;
  }
  public set transcriptSegments(val: Array<{ startMs: number; endMs: number; text: string }>) {
    this.transcript_segments = val;
  }

  public get transcriptId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type TranscriptDocument = DocumentType<TranscriptClass>;
export const Transcript = getModelForClass(TranscriptClass);
