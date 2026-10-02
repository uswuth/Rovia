import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import {
  createMeeting,
  getMeetings,
  getMeetingById,
  previewMeetingByJoinCode,
  joinMeeting,
  leaveMeeting,
  addMeetingParticipants,
  updateMeetingParticipantSettings,
  startMeeting,
  endMeeting
} from '../controllers/meeting.controller.js';

const router: Router = Router();

/**
 * Every meeting route requires authentication. The organization always comes
 * from the verified JWT, so a join code alone never grants access to another
 * tenant's meeting.
 */
router.use(authenticateUser);

/**
 * @openapi
 * /api/v1/meetings:
 *   post:
 *     summary: Schedule a Meeting
 *     description: >
 *       Creates a meeting under a project. Participants must be members or hosts
 *       of that project; an organization invite code does not bypass this. The
 *       participant limit defaults to 50 and may only be lowered. A shareable
 *       UUID join code is generated server-side.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, meetingTitle, meetingScheduledAt]
 *             properties:
 *               projectId:
 *                 type: string
 *               meetingTitle:
 *                 type: string
 *               meetingDescription:
 *                 type: string
 *               meetingScheduledAt:
 *                 type: string
 *                 format: date-time
 *               meetingDurationMinutes:
 *                 type: integer
 *               meetingJoinMode:
 *                 type: string
 *                 enum: [INVITE_ONLY, OPEN_LINK]
 *               meetingParticipantLimit:
 *                 type: integer
 *                 description: 1-50. Can only lower the default, never raise it.
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Meeting created
 *       400:
 *         description: Invalid input, non-project members, or over the limit
 *       403:
 *         description: Creator is not a member of the project
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const meeting = await createMeeting(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings:
 *   get:
 *     summary: List Meetings for the organization
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, LIVE, ENDED, CANCELLED]
 *       - in: query
 *         name: mine
 *         schema:
 *           type: string
 *           description: Pass "true" to list only meetings you are on the roster for.
 *     responses:
 *       200:
 *         description: Paginated meetings
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const meetings = await getMeetings(req, res);
    return meetings;
  })
);

// Static segment before "/:id" so the join-code route is not captured by it.
router.get(
  '/join/:code',
  asyncHandler(async (req, res) => {
    const preview = await previewMeetingByJoinCode(req, res);
    return preview;
  })
);
