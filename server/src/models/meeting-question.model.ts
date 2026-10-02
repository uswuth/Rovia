import { prop, getModelForClass, DocumentType, modelOptions, Severity, Ref } from '@typegoose/typegoose';
import { OrganizationClass } from './organization.model.js';

export type MeetingQuestionStatus = 'OPEN' | 'ANSWERED' | 'DISMISSED';

/** An answer is authored by a participant, never by a client-supplied id list. */
@modelOptions({ schemaOptions: { _id: true } })
export class MeetingQuestionAnswerClass {
  @prop({ type: () => String, required: true, index: true })
  public userId!: string;

  @prop({ type: () => String, required: true })
  public answerText!: string;

  @prop({ type: () => Date, required: true, alias: 'createdAt' })
  public created_at!: Date;
}

@modelOptions({
  schemaOptions: {
    collection: 'meeting_questions',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          questionId: (ret._id as { toString(): string })?.toString(),
          questionText: ret.question_text as string,
          questionStatus: ret.question_status as string,
          answers: (ret.question_answers as unknown[]) || [],
          answerCount: ((ret.question_answers as unknown[]) ?? []).length,
          organizationId: ret.organization_id,
          meetingId: ret.meeting_id,
          askedBy: ret.asked_by,
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    },
    toObject: { virtuals: true }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class MeetingQuestionClass {
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

  @prop({ type: () => String, required: true, trim: true, alias: 'questionText' })
  public question_text!: string;

  public get questionText(): string {
    return this.question_text;
  }
  public set questionText(val: string) {
    this.question_text = val;
  }

  @prop({
    type: () => String,
    enum: ['OPEN', 'ANSWERED', 'DISMISSED'],
    default: 'OPEN',
    index: true,
    alias: 'questionStatus'
  })
  public question_status!: MeetingQuestionStatus;

  public get questionStatus(): MeetingQuestionStatus {
    return this.question_status;
  }
  public set questionStatus(val: MeetingQuestionStatus) {
    this.question_status = val;
  }

  @prop({ type: () => [MeetingQuestionAnswerClass], default: [], alias: 'answers' })
  public question_answers!: Array<MeetingQuestionAnswerClass>;

  public get answers(): Array<MeetingQuestionAnswerClass> {
    return this.question_answers;
  }
  public set answers(val: Array<MeetingQuestionAnswerClass>) {
    this.question_answers = val;
  }

  @prop({ type: () => String, required: true, index: true, alias: 'askedBy' })
  public asked_by!: string;

  public get askedBy(): string {
    return this.asked_by;
  }
  public set askedBy(val: string) {
    this.asked_by = val;
  }

  public get questionId(): string {
    return (this as unknown as { _id?: { toString(): string } })._id?.toString() || '';
  }
}

export type MeetingQuestionDocument = DocumentType<MeetingQuestionClass>;
export const MeetingQuestion = getModelForClass(MeetingQuestionClass);
