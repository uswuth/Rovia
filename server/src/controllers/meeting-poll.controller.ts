import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  createPollService,
  votePollService,
  closePollService,
  getMeetingPollsService
} from '../services/meeting-poll.service.js';

export const createPoll = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { pollQuestion, options, multipleChoice } = req.body as {
    pollQuestion?: string;
    options?: string[];
    multipleChoice?: boolean;
  };

  const poll = await createPollService(
    req.params.id,
    organizationId,
    userId,
    pollQuestion ?? '',
    options ?? [],
    Boolean(multipleChoice)
  );
  return ApiResponse.success(res, 'Poll created successfully', poll, 201);
};

export const votePoll = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { optionIds } = req.body as { optionIds?: string[] };

  const poll = await votePollService(
    req.params.id,
    req.params.pollId,
    organizationId,
    userId,
    optionIds ?? []
  );
  return ApiResponse.success(res, 'Vote recorded successfully', poll, 200);
};

export const getMeetingPolls = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const polls = await getMeetingPollsService(
    req.params.id,
    organizationId,
    userId,
    req.query as Record<string, unknown>
  );
  return ApiResponse.success(res, 'Polls retrieved successfully', polls, 200);
};

export const closePoll = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const poll = await closePollService(req.params.id, req.params.pollId, organizationId, userId);
  return ApiResponse.success(res, 'Poll closed successfully', poll, 200);
};
