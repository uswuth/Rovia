import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { UserClass } from './user.model.js';
import { OrganizationClass } from './organization.model.js';

export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type MeetingJoinMode = 'INVITE_ONLY' | 'OPEN_LINK';
export type MeetingParticipantRole = 'HOST' | 'MODERATOR' | 'MEMBER';
export type MeetingParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT';

/**
 * Per-participant capabilities. A host can restrict an individual member
 * without affecting everyone else in the meeting.
 */
@modelOptions({ schemaOptions: { _id: false } })
export class MeetingParticipantClass {
  @prop({ type: () => String, required: true, index: true })
  public userId!: string;

  @prop({
    type: () => String,
    enum: ['HOST', 'MODERATOR', 'MEMBER'],
    default: 'MEMBER',
    alias: 'participantRole'
  })
  public participant_role!: MeetingParticipantRole;

  @prop({
    type: () => String,
    enum: ['INVITED', 'JOINED', 'LEFT'],
    default: 'INVITED',
    alias: 'participantStatus'
  })
  public participant_status!: MeetingParticipantStatus;

  @prop({ type: () => Boolean, default: true, alias: 'canSendAudio' })
  public can_send_audio!: boolean;

  @prop({ type: () => Boolean, default: true, alias: 'canSendVideo' })
  public can_send_video!: boolean;

  @prop({ type: () => Boolean, default: true, alias: 'canShareScreen' })
  public can_share_screen!: boolean;

  @prop({ type: () => Boolean, default: true, alias: 'canUseChat' })
  public can_use_chat!: boolean;

  @prop({ type: () => Date, default: null, alias: 'joinedAt' })
  public joined_at?: Date | null;

  @prop({ type: () => Date, default: null, alias: 'leftAt' })
  public left_at?: Date | null;
}

/** Default ceiling. An organization may lower it per meeting, never raise it. */
export const MEETING_DEFAULT_PARTICIPANT_LIMIT = 50;
export const MEETING_MAX_DURATION_MINUTES = 480;

@modelOptions({
  schemaOptions: {
    collection: 'meetings',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          meetingId: (ret._id as { toString(): string })?.toString(),
          meetingTitle: ret.meeting_title as string,
          meetingDescription: ret.meeting_description ?? '',
          meetingStatus: ret.meeting_status as string,
          meetingJoinMode: ret.meeting_join_mode as string,
          meetingScheduledAt: ret.meeting_scheduled_at,
          meetingDurationMinutes: ret.meeting_duration_minutes,
          meetingParticipantLimit: ret.meeting_participant_limit,
          meetingJoinCode: ret.meeting_join_code,
          organizationId: ret.organization_id,
          projectId: ret.project_id,
          createdBy: ret.created_by,
          startedAt: ret.meeting_started_at ?? null,
          endedAt: ret.meeting_ended_at ?? null,
          participants: ret.meeting_participants || [],
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class MeetingClass {
  @prop({ ref: () => 'OrganizationClass', required: true, index: true, alias: 'organizationId' })
  public organization_id!: Ref<OrganizationClass>;

  public get organizationId(): Ref<OrganizationClass> {
    return this.organization_id;
  }
  public set organizationId(val: Ref<OrganizationClass>) {
    this.organization_id = val;
  }

  /** The roster a meeting may draw from. Members must belong to this project. */
  @prop({ ref: () => 'ProjectClass', required: true, index: true, alias: 'projectId' })
  public project_id!: Ref<'ProjectClass'>;

  public get projectId(): Ref<'ProjectClass'> {
    return this.project_id;
  }
  public set projectId(val: Ref<'ProjectClass'>) {
    this.project_id = val;
  }

  @prop({ type: () => String, required: true, trim: true, alias: 'meetingTitle' })
  public meeting_title!: string;

  public get meetingTitle(): string {
    return this.meeting_title;
  }
  public set meetingTitle(val: string) {
    this.meeting_title = val;
  }

  @prop({ type: () => String, default: '', alias: 'meetingDescription' })
  public meeting_description!: string;

  public get meetingDescription(): string {
    return this.meeting_description;
  }
  public set meetingDescription(val: string) {
    this.meeting_description = val;
  }

  /** The shareable UUID segment of the join URL. Unique, and never guessable. */
  @prop({ type: () => String, required: true, unique: true, index: true, alias: 'meetingJoinCode' })
  public meeting_join_code!: string;

  public get meetingJoinCode(): string {
    return this.meeting_join_code;
  }
  public set meetingJoinCode(val: string) {
    this.meeting_join_code = val;
  }

  @prop({
    type: () => String,
    enum: ['INVITE_ONLY', 'OPEN_LINK'],
    default: 'INVITE_ONLY',
    alias: 'meetingJoinMode'
  })
  public meeting_join_mode!: MeetingJoinMode;

  public get meetingJoinMode(): MeetingJoinMode {
    return this.meeting_join_mode;
  }
  public set meetingJoinMode(val: MeetingJoinMode) {
    this.meeting_join_mode = val;
  }

  @prop({
    type: () => String,
    enum: ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
    default: 'SCHEDULED',
    index: true,
    alias: 'meetingStatus'
  })
  public meeting_status!: MeetingStatus;

  public get meetingStatus(): MeetingStatus {
    return this.meeting_status;
  }
  public set meetingStatus(val: MeetingStatus) {
    this.meeting_status = val;
  }

  @prop({ type: () => Date, required: true, index: true, alias: 'meetingScheduledAt' })
  public meeting_scheduled_at!: Date;

  public get meetingScheduledAt(): Date {
    return this.meeting_scheduled_at;
  }
  public set meetingScheduledAt(val: Date) {
    this.meeting_scheduled_at = val;
  }

  @prop({ type: () => Number, default: 30, alias: 'meetingDurationMinutes' })
  public meeting_duration_minutes!: number;

  public get meetingDurationMinutes(): number {
    return this.meeting_duration_minutes;
  }
  public set meetingDurationMinutes(val: number) {
    this.meeting_duration_minutes = val;
  }

  /** Default 50, may only be lowered, never above the project's roster. */
  @prop({ type: () => Number, default: MEETING_DEFAULT_PARTICIPANT_LIMIT, alias: 'meetingParticipantLimit' })
  public meeting_participant_limit!: number;

  public get meetingParticipantLimit(): number {
    return this.meeting_participant_limit;
  }
  public set meetingParticipantLimit(val: number) {
    this.meeting_participant_limit = val;
  }

  @prop({ type: () => [MeetingParticipantClass], default: [], alias: 'participants' })
  public meeting_participants!: Array<MeetingParticipantClass>;

  public get participants(): Array<MeetingParticipantClass> {
    return this.meeting_participants;
  }
  public set participants(val: Array<MeetingParticipantClass>) {
    this.meeting_participants = val;
  }

  @prop({ ref: () => UserClass, required: true, alias: 'createdBy' })
  public created_by!: Ref<UserClass>;

  public get createdBy(): Ref<UserClass> {
    return this.created_by;
  }
  public set createdBy(val: Ref<UserClass>) {
    this.created_by = val;
  }

  @prop({ type: () => Date, default: null, alias: 'startedAt' })
  public meeting_started_at?: Date | null;

  public get startedAt(): Date | null {
    return this.meeting_started_at ?? null;
  }
  public set startedAt(val: Date | null) {
    this.meeting_started_at = val;
  }

  @prop({ type: () => Date, default: null, alias: 'endedAt' })
  public meeting_ended_at?: Date | null;

  public get endedAt(): Date | null {
    return this.meeting_ended_at ?? null;
  }
  public set endedAt(val: Date | null) {
    this.meeting_ended_at = val;
  }

  public get meetingId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type MeetingDocument = DocumentType<MeetingClass>;
export const Meeting = getModelForClass(MeetingClass);

