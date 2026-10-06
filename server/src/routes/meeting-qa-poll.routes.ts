import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import {
  askQuestion,
  answerQuestion,
  getMeetingQuestions,
  dismissQuestion
} from '../controllers/meeting-qa.controller.js';
import {
  createPoll,
  votePoll,
  getMeetingPolls,
  closePoll
} from '../controllers/meeting-poll.controller.js';

const router: Router = Router();

/**
 * In-meeting features. Every route requires authentication, and every service
 * re-checks that the caller is on the meeting roster and permitted to chat, so
 * an authenticated non-participant cannot read or write meeting content.
 */
router.use(authenticateUser);

/**
 * @openapi
 * /api/v1/meetings/{id}/questions:
 *   post:
 *     summary: Ask a question in a meeting
 *     description: Requires roster membership and chat permission.
 *     tags:
 *       - Meeting Q&A
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionText]
 *             properties:
 *               questionText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Question created
 *       403:
 *         description: Not a participant, or chat is disabled for you
 *       404:
 *         description: Meeting not found
 */
router.post(
  '/:id/questions',
  asyncHandler(async (req, res) => {
    const question = await askQuestion(req, res);
    return question;
  })
);

router.get(
  '/:id/questions',
  asyncHandler(async (req, res) => {
    const questions = await getMeetingQuestions(req, res);
    return questions;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/questions/{questionId}/answers:
 *   post:
 *     summary: Answer a question
 *     description: >
 *       Any roster member may answer. The answer author is taken from the
 *       authenticated caller, never from the request body, and the question
 *       moves to ANSWERED.
 *     tags:
 *       - Meeting Q&A
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answerText]
 *             properties:
 *               answerText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer recorded
 *       400:
 *         description: Question was dismissed
 *       403:
 *         description: Not a participant in this meeting
 *       404:
 *         description: Meeting or question not found
 */
router.post(
  '/:id/questions/:questionId/answers',
  asyncHandler(async (req, res) => {
    const question = await answerQuestion(req, res);
    return question;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/questions/{questionId}/dismiss:
 *   post:
 *     summary: Dismiss a question
 *     description: Permitted for the person who asked it, or a host or moderator.
 *     tags:
 *       - Meeting Q&A
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question dismissed
 *       403:
 *         description: Not the asker and not a host or moderator
 *       404:
 *         description: Meeting or question not found
 */
router.post(
  '/:id/questions/:questionId/dismiss',
  asyncHandler(async (req, res) => {
    const question = await dismissQuestion(req, res);
    return question;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/polls:
 *   post:
 *     summary: Create a poll (host or moderator only)
 *     tags:
 *       - Meeting Polls
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pollQuestion, options]
 *             properties:
 *               pollQuestion:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 2-10 options.
 *               multipleChoice:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Poll created
 *       400:
 *         description: Fewer than two options, or more than ten
 *       403:
 *         description: Not a host or moderator
 */

router.post(
    '/:id/polls',
    asyncHandler(async (req, res) => {
      const poll = await createPoll(req, res);
      return poll;
    })
  );

router.get(
  '/:id/polls',
  asyncHandler(async (req, res) => {
    const polls = await getMeetingPolls(req, res);
    return polls;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/polls/{pollId}/vote:
 *   post:
 *     summary: Vote in a poll
 *     description: >
 *       Re-voting replaces the caller's previous selection rather than adding to
 *       it, so repeated voting cannot inflate a count. Single-choice polls
 *       reject more than one optionId.
 *     tags:
 *       - Meeting Polls
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [optionIds]
 *             properties:
 *               optionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Vote recorded
 *       400:
 *         description: Poll closed, or multiple selections on a single-choice poll
 *       403:
 *         description: Not a participant in this meeting
 */
router.post(
  '/:id/polls/:pollId/vote',
  asyncHandler(async (req, res) => {
    const poll = await votePoll(req, res);
    return poll;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/polls/{pollId}/close:
 *   post:
 *     summary: Close a poll (host or moderator only)
 *     description: A closed poll rejects further votes.
 *     tags:
 *       - Meeting Polls
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pollId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Poll closed
 *       403:
 *         description: Not a host or moderator
 *       404:
 *         description: Meeting or poll not found
 */
router.post(
  '/:id/polls/:pollId/close',
  asyncHandler(async (req, res) => {
    const poll = await closePoll(req, res);
    return poll;
  })
);

export default router;
