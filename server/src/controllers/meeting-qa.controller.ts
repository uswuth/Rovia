import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse.js';
import { getRequestScope } from '../utils/scope.js';
import {
  askQuestionService,
  answerQuestionService,
  dismissQuestionService,
  getMeetingQuestionsService
} from '../services/meeting-qa.service.js';

export const askQuestion = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { questionText } = req.body as { questionText?: string };
  const question = await askQuestionService(req.params.id, organizationId, userId, questionText ?? '');
  return ApiResponse.success(res, 'Question asked successfully', question, 201);
};

export const answerQuestion = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const { answerText } = req.body as { answerText?: string };
  const question = await answerQuestionService(
    req.params.id,
    req.params.questionId,
    organizationId,
    userId,
    answerText ?? ''
  );
  return ApiResponse.success(res, 'Question answered successfully', question, 200);
};

export const getMeetingQuestions = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const questions = await getMeetingQuestionsService(
    req.params.id,
    organizationId,
    userId,
    req.query as Record<string, unknown>
  );
  return ApiResponse.success(res, 'Questions retrieved successfully', questions, 200);
};

export const dismissQuestion = async (req: Request, res: Response): Promise<Response> => {
  const { organizationId, userId } = getRequestScope(req);
  const question = await dismissQuestionService(
    req.params.id,
    req.params.questionId,
    organizationId,
    userId
  );
  return ApiResponse.success(res, 'Question dismissed successfully', question, 200);
};
