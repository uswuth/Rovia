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

/**
 * @openapi
 * /api/v1/meetings/join/{code}:
 *   get:
 *     summary: Preview a meeting from its shareable link
 *     description: >
 *       Returns only summary fields so a recipient can see what they are joining.
 *       Tenant scoped: a join code from another organization resolves to 404.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting preview
 *       404:
 *         description: No such meeting in this organization
 */
router.get(
  '/join/:code',
  asyncHandler(async (req, res) => {
    const preview = await previewMeetingByJoinCode(req, res);
    return preview;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}:
 *   get:
 *     summary: Get a Meeting
 *     description: Tenant scoped. A meeting in another organization returns 404.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting with its roster and per-member permissions
 *       404:
 *         description: Meeting not found
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const meeting = await getMeetingById(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/join:
 *   post:
 *     summary: Join a Meeting
 *     description: >
 *       Requires authentication and same-organization membership. On an
 *       INVITE_ONLY meeting only the assigned roster may join; on an OPEN_LINK
 *       meeting any authenticated member of the organization may join until the
 *       participant limit is reached.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined
 *       403:
 *         description: Invite only and not on the roster
 *       404:
 *         description: Meeting not found in this organization
 */
router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const meeting = await joinMeeting(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/leave:
 *   post:
 *     summary: Leave a meeting
 *     description: Marks your participation as LEFT. The recording is unaffected.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left
 *       404:
 *         description: Meeting not found, or you were not a participant
 */
router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const meeting = await leaveMeeting(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/participants:
 *   post:
 *     summary: Add participants to a meeting
 *     description: >
 *       Host or moderator only. Each user must already be a member or host of
 *       the meeting's project; an organization invite code does not qualify
 *       them. Adding beyond the participant limit is rejected.
 *     tags:
 *       - Meetings
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
 *             required: [participantIds]
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Participants added
 *       400:
 *         description: Not project members, or would exceed the limit
 *       403:
 *         description: Not a host or moderator
 */
router.post(
  '/:id/participants',
  asyncHandler(async (req, res) => {
    const meeting = await addMeetingParticipants(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/participant-settings:
 *   post:
 *     summary: Update a participant's permissions
 *     description: >
 *       Per-member capability toggles for microphone, camera, screen share and
 *       chat. Only the meeting host or a moderator may do this.
 *     tags:
 *       - Meetings
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
 *             required: [participantId]
 *             properties:
 *               participantId:
 *                 type: string
 *               canSendAudio:
 *                 type: boolean
 *               canSendVideo:
 *                 type: boolean
 *               canShareScreen:
 *                 type: boolean
 *               canUseChat:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
 *       403:
 *         description: Not a host or moderator
 *       404:
 *         description: Meeting or participant not found
 */
router.post(
  '/:id/participant-settings',
  asyncHandler(async (req, res) => {
    const meeting = await updateMeetingParticipantSettings(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/start:
 *   post:
 *     summary: Start a meeting
 *     description: Host or moderator only. Moves SCHEDULED to LIVE.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting started
 *       400:
 *         description: Meeting already finished or cancelled
 *       403:
 *         description: Not a host or moderator
 */
router.post(
  '/:id/start',
  asyncHandler(async (req, res) => {
    const meeting = await startMeeting(req, res);
    return meeting;
  })
);

/**
 * @openapi
 * /api/v1/meetings/{id}/end:
 *   post:
 *     summary: End a meeting
 *     description: Host or moderator only. Moves the meeting to ENDED and stamps the end time.
 *     tags:
 *       - Meetings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting ended
 *       403:
 *         description: Not a host or moderator
 */
router.post(
  '/:id/end',
  asyncHandler(async (req, res) => {
    const meeting = await endMeeting(req, res);
    return meeting;
  })
);

export default router;
