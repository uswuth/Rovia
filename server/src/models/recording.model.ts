import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { UserClass } from './user.model.js';
import { OrganizationClass } from './organization.model.js';

export type RecordingStatus = 'PENDING' | 'READY' | 'FAILED' | 'DELETED';

/**
 * One participant's captured audio within a recording.
 *
 * Each speaker is stored as a separate object so tracks can be transcribed
 * independently. Crosstalk between simultaneous speakers is what garbles a
 * transcript, so mixing everyone into one stream is what we are avoiding here.
 * The storage key is server-derived and never sent to the client.
 */
@modelOptions({ schemaOptions: { _id: false } })
export class RecordingSpeakerClass {
  @prop({ type: () => String, required: true })
  public speakerId!: string;

  @prop({ type: () => String, default: '' })
  public speakerName!: string;

  @prop({ type: () => Number, required: true })
  public speakerIndex!: number;

  /** Server-derived. Excluded from toJSON with the other storage internals. */
  @prop({ type: () => String, required: true })
  public storageKey!: string;

  @prop({ type: () => String, default: '' })
  public mimeType!: string;

  @prop({ type: () => Number, default: 0 })
  public sizeBytes!: number;

  /** Null until the client has uploaded this speaker's track. */
  @prop({ type: () => Boolean, default: false })
  public uploaded!: boolean;
}

@modelOptions({
  schemaOptions: {
    collection: 'recordings',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        // storage_key and each speaker's storageKey are deliberately absent: the
        // client never receives them, so it can never construct, cache or log an
        // object path. Speakers are projected to their identity and upload state.
        const speakers = ((ret.recording_speakers as unknown[]) ?? []).map((entry) => {
          const speaker = entry as {
            speakerId?: string;
            speakerName?: string;
            speakerIndex?: number;
            uploaded?: boolean;
            sizeBytes?: number;
          };
          return {
            speakerId: speaker.speakerId,
            speakerName: speaker.speakerName ?? '',
            speakerIndex: speaker.speakerIndex,
            uploaded: Boolean(speaker.uploaded),
            sizeBytes: speaker.sizeBytes ?? 0
          };
        });
        return {
          recordingId: (ret._id as { toString(): string })?.toString(),
          recordingStatus: ret.recording_status as string,
          recordingMimeType: ret.recording_mime_type as string,
          recordingSizeBytes: ret.recording_size_bytes as number,
          recordingDurationMs: ret.recording_duration_ms as number,
          recordingSpeakers: speakers,
          organizationId: ret.organization_id,
          projectId: ret.project_id ?? null,
          meetingId: ret.meeting_id ?? null,
          createdBy: ret.created_by,
          recordingExpiresAt: ret.recording_expires_at,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class RecordingClass {
  @prop({ ref: () => 'OrganizationClass', required: true, index: true, alias: 'organizationId' })
  public organization_id!: Ref<OrganizationClass>;

  public get organizationId(): Ref<OrganizationClass> {
    return this.organization_id;
  }
  public set organizationId(val: Ref<OrganizationClass>) {
    this.organization_id = val;
  }

  @prop({ ref: () => UserClass, required: true, index: true, alias: 'createdBy' })
  public created_by!: Ref<UserClass>;

  public get createdBy(): Ref<UserClass> {
    return this.created_by;
  }
  public set createdBy(val: Ref<UserClass>) {
    this.created_by = val;
  }

  /**
   * Server-derived from the caller's organization and this document's id.
   * Never accepted from a request. Hidden from toJSON.
   */
  @prop({ type: () => String, required: true, unique: true, alias: 'storageKey' })
  public storage_key!: string;

  public get storageKey(): string {
    return this.storage_key;
  }
  public set storageKey(val: string) {
    this.storage_key = val;
  }

  /**
   * One entry per participant who had audio captured. Keys are server-derived
   * from this recording's organization and id, so a client can only ever address
   * its own recording's own speakers.
   */
  @prop({ type: () => [RecordingSpeakerClass], default: [], alias: 'recordingSpeakers' })
  public recording_speakers!: Array<RecordingSpeakerClass>;

  public get recordingSpeakers(): Array<{
    speakerId: string;
    speakerName: string;
    speakerIndex: number;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    uploaded: boolean;
  }> {
    return this.recording_speakers;
  }
  public set recordingSpeakers(
    val: Array<{
      speakerId: string;
      speakerName: string;
      speakerIndex: number;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      uploaded: boolean;
    }>
  ) {
    this.recording_speakers = val;
  }

  @prop({
    type: () => String,
    enum: ['PENDING', 'READY', 'FAILED', 'DELETED'],
    default: 'PENDING',
    index: true,
    alias: 'recordingStatus'
  })
  public recording_status!: RecordingStatus;

  public get recordingStatus(): RecordingStatus {
    return this.recording_status;
  }
  public set recordingStatus(val: RecordingStatus) {
    this.recording_status = val;
  }

  /** From HeadObject.ContentType, NOT from the request. */
  @prop({ type: () => String, required: true, alias: 'recordingMimeType' })
  public recording_mime_type!: string;

  public get recordingMimeType(): string {
    return this.recording_mime_type;
  }
  public set recordingMimeType(val: string) {
    this.recording_mime_type = val;
  }

  /** From HeadObject.ContentLength, NOT from the request. */
  @prop({ type: () => Number, default: 0, alias: 'recordingSizeBytes' })
  public recording_size_bytes!: number;

  public get recordingSizeBytes(): number {
    return this.recording_size_bytes;
  }
  public set recordingSizeBytes(val: number) {
    this.recording_size_bytes = val;
  }

  /** Measured by MediaRecorder at stop. Advisory only; never a policy gate. */
  @prop({ type: () => Number, default: 0, alias: 'recordingDurationMs' })
  public recording_duration_ms!: number;

  public get recordingDurationMs(): number {
    return this.recording_duration_ms;
  }
  public set recordingDurationMs(val: number) {
    this.recording_duration_ms = val;
  }

  @prop({ type: () => Types.ObjectId, index: true, default: null, alias: 'projectId' })
  public project_id?: Types.ObjectId | null;

  public get projectId(): Types.ObjectId | null {
    return this.project_id ?? null;
  }
  public set projectId(val: Types.ObjectId | null) {
    this.project_id = val;
  }

  /**
   * Opaque id only. Deliberately NOT a ref: the Meeting domain does not exist
   * yet, and a ref to a missing collection populates to null silently. Becomes
   * a real foreign key when meetings land.
   */
  @prop({ type: () => Types.ObjectId, index: true, default: null, alias: 'meetingId' })
  public meeting_id?: Types.ObjectId | null;

  public get meetingId(): Types.ObjectId | null {
    return this.meeting_id ?? null;
  }
  public set meetingId(val: Types.ObjectId | null) {
    this.meeting_id = val;
  }

  @prop({ type: () => Date, required: true, index: true, alias: 'recordingExpiresAt' })
  public recording_expires_at!: Date;

  public get recordingExpiresAt(): Date {
    return this.recording_expires_at;
  }
  public set recordingExpiresAt(val: Date) {
    this.recording_expires_at = val;
  }

  public get recordingId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type RecordingDocument = DocumentType<RecordingClass>;
export const Recording = getModelForClass(RecordingClass);
