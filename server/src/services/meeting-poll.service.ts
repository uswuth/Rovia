import crypto from 'node:crypto';
import { MeetingPoll, MeetingPollDocument, MeetingPollOptionClass } from '../models/meeting-poll.model.js';
import { ApiError } from '../utils/apiError.js';
import { assertObjectId } from '../utils/objectId.js';
import { requireOrganizationId } from '../utils/scope.js';
import { findPaginated } from '../utils/paginatedFind.js';
import { findScopedMeeting, assertMeetingParticipant } from './meeting.service.js';

const MAX_POLL_OPTIONS = 10;

const findScopedPoll = async (pollId: string, organizationId: string): Promise<MeetingPollDocument> => {
  const poll = await MeetingPoll.findOne({ _id: pollId, organization_id: organizationId });
  if (!poll) {
    throw ApiError.notFound('Poll not found');
  }
  return poll;
};

export const createPollService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  pollQuestion: string,
  optionTexts: string[],
  multipleChoice: boolean
): Promise<MeetingPollDocument> => {
  requireOrganizationId(organizationId, 'create a poll');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  const participant = assertMeetingParticipant(meeting, userId);
  const isManager = participant.participant_role === 'HOST' || participant.participant_role === 'MODERATOR';
  if (!isManager) {
    throw ApiError.forbidden('Only a meeting host or moderator can create a poll');
  }

  const question = (pollQuestion || '').trim();
  if (!question) {
    throw ApiError.badRequest('pollQuestion is required', [{ field: 'pollQuestion', message: 'Required' }]);
  }

  const options = (optionTexts ?? []).map((o) => (o || '').trim()).filter(Boolean);
  if (options.length < 2) {
    throw ApiError.badRequest('A poll needs at least two options', [
      { field: 'options', message: 'At least two non-empty options are required' }
    ]);
  }
  if (options.length > MAX_POLL_OPTIONS) {
    throw ApiError.badRequest(`A poll can have at most ${MAX_POLL_OPTIONS} options`);
  }

  const poll = new MeetingPoll({
    organization_id: organizationId,
    meeting_id: meetingId,
    poll_question: question,
    poll_status: 'OPEN',
    poll_multiple_choice: Boolean(multipleChoice),
    created_by: userId,
    poll_options: options.map((optionText) => {
      const option = new MeetingPollOptionClass();
      option.optionId = crypto.randomUUID();
      option.optionText = optionText;
      option.voterIds = [];
      return option;
    })
  });
  await poll.save();
  return poll;
};

export const votePollService = async (
  meetingId: string,
  pollId: string,
  organizationId: string,
  userId: string,
  optionIds: string[]
): Promise<MeetingPollDocument> => {
  requireOrganizationId(organizationId, 'vote in a poll');
  assertObjectId(meetingId, 'meetingId');
  assertObjectId(pollId, 'pollId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertMeetingParticipant(meeting, userId);

  const poll = await findScopedPoll(pollId, organizationId);
  if (String(poll.meeting_id) !== meetingId) {
    throw ApiError.notFound('Poll not found in this meeting');
  }
  if (poll.poll_status === 'CLOSED') {
    throw ApiError.badRequest('This poll is closed');
  }

  const requested = [...new Set(optionIds ?? [])];
  if (requested.length === 0) {
    throw ApiError.badRequest('At least one optionId is required', [
      { field: 'optionIds', message: 'Select at least one option' }
    ]);
  }
  if (!poll.poll_multiple_choice && requested.length > 1) {
    throw ApiError.badRequest('This poll allows only one selection');
  }

  const known = new Set(poll.poll_options.map((o) => o.optionId));
  const unknown = requested.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw ApiError.badRequest('Unknown optionIds', [{ field: 'optionIds', message: unknown.join(', ') }]);
  }

  // Already-voted selections are removed so re-voting is a change, not a
  // duplicate. This is what makes repeated voting safe rather than additive.
  for (const option of poll.poll_options) {
    option.voterIds = option.voterIds.filter((voterId) => voterId !== userId);
  }
  for (const optionId of requested) {
    const option = poll.poll_options.find((o) => o.optionId === optionId);
    option?.voterIds.push(userId);
  }

  await poll.save();
  return poll;
};

export const closePollService = async (
  meetingId: string,
  pollId: string,
  organizationId: string,
  userId: string
): Promise<MeetingPollDocument> => {
  requireOrganizationId(organizationId, 'close a poll');
  assertObjectId(meetingId, 'meetingId');
  assertObjectId(pollId, 'pollId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  const participant = assertMeetingParticipant(meeting, userId);
  const isManager = participant.participant_role === 'HOST' || participant.participant_role === 'MODERATOR';
  if (!isManager) {
    throw ApiError.forbidden('Only a meeting host or moderator can close a poll');
  }

  const poll = await findScopedPoll(pollId, organizationId);
  if (String(poll.meeting_id) !== meetingId) {
    throw ApiError.notFound('Poll not found in this meeting');
  }

  poll.poll_status = 'CLOSED';
  await poll.save();
  return poll;
};

export const getMeetingPollsService = async (
  meetingId: string,
  organizationId: string,
  userId: string,
  query: Record<string, unknown>
) => {
  requireOrganizationId(organizationId, 'view polls');
  assertObjectId(meetingId, 'meetingId');

  const meeting = await findScopedMeeting(meetingId, organizationId);
  assertMeetingParticipant(meeting, userId);

  const filter: Record<string, unknown> = { meeting_id: meetingId, organization_id: organizationId };
  if (query.status) filter.poll_status = query.status;

  return findPaginated(MeetingPoll, filter, query, { sort: { created_at: 1 } });
};
