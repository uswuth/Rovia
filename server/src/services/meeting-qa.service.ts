import { MeetingQuestion, MeetingQuestionDocument, MeetingQuestionAnswerClass } from '../models/meeting-question.model.js';
import { ApiError } from '../utils/apiError.js';
import { assertObjectId } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { findScopedMeeting, assertMeetingParticipant, assertMeetingCanChat } from './meeting.service.js';

/** Tenant scoped: a question from another organization is never reachable. */
const findScopedQuestion = async (questionId: string, organizationId: string): Promise<MeetingQuestionDocument> => {
  const question = await MeetingQuestion.findOne({ _id: questionId, organization_id: organizationId });
  if (!question) {
    throw ApiError.notFound('Question not found');
  }
  return question;
};

export const askQuestionService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  questionText: string
): Promise<MeetingQuestionDocument> => {
  requireOrganizationId(organizationId, 'ask a question');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertMeetingCanChat(meeting, userId);

  const text = (questionText || '').trim();
  if (!text) {
    throw ApiError.badRequest('questionText is required', [{ field: 'questionText', message: 'Required' }]);
  }

  const question = new MeetingQuestion({
    organization_id: organizationId,
    meeting_id: meetingId,
    question_text: text,
    question_status: 'OPEN',
    asked_by: userId
  });
  await question.save();
  return question;
};

export const answerQuestionService = async (
  meetingId: string,
  questionId: string,
  organizationId: string,
  userId: string,
  answerText: string
): Promise<MeetingQuestionDocument> => {
  requireOrganizationId(organizationId, 'answer a question');
  assertObjectId(meetingId, 'meetingId');
  assertObjectId(questionId, 'questionId');

  // Meeting is loaded first so membership is proven before the question is read.
  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertMeetingParticipant(meeting, userId);

  const text = (answerText || '').trim();
  if (!text) {
    throw ApiError.badRequest('answerText is required', [{ field: 'answerText', message: 'Required' }]);
  }

  const question = await findScopedQuestion(questionId, organizationId);
  if (String(question.meeting_id) !== meetingId) {
    throw ApiError.notFound('Question not found in this meeting');
  }
  if (question.question_status === 'DISMISSED') {
    throw ApiError.badRequest('This question has been dismissed');
  }

  // The author is always the authenticated caller, never a client-supplied id.
  const answer = new MeetingQuestionAnswerClass();
  answer.userId = userId;
  answer.answerText = text;
  answer.created_at = new Date();

  question.question_answers.push(answer);
  question.question_status = 'ANSWERED';
  await question.save();
  return question;
};

export const getMeetingQuestionsService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  query: Record<string, unknown>
) => {
  requireOrganizationId(organizationId, 'view questions');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertMeetingParticipant(meeting, userId);

  const filter: Record<string, unknown> = { meeting_id: meetingId, organization_id: organizationId };
  if (query.status) filter.question_status = query.status;

  return findPaginated(MeetingQuestion, filter, query, { sort: { created_at: 1 } });
};

export const dismissQuestionService = async (
  meetingId: string,
  questionId: string,
  organizationId: string,
  userId: string
): Promise<MeetingQuestionDocument> => {
  requireOrganizationId(organizationId, 'dismiss a question');
  assertObjectId(meetingId, 'meetingId');
  assertObjectId(questionId, 'questionId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  const participant = assertMeetingParticipant(meeting, userId);

  const question = await findScopedQuestion(questionId, organizationId);
  if (String(question.meeting_id) !== meetingId) {
    throw ApiError.notFound('Question not found in this meeting');
  }

  const isManager = participant.participant_role === 'HOST' || participant.participant_role === 'MODERATOR';
  if (question.asked_by !== userId && !isManager) {
    throw ApiError.forbidden('Only the asker or a host can dismiss this question');
  }

  question.question_status = 'DISMISSED';
  await question.save();
  return question;
};
