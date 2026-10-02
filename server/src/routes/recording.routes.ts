import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import {
  createRecording,
  getRecordings,
  getRecordingById,
  getRecordingUploadUrl,
  completeRecording,
  getRecordingDownloadUrl,
  deleteRecording,
  getRecordingTranscript,
  getRecordingSummary
} from '../controllers/recording.controller.js';

const router: Router = Router();

// Every recording route requires authentication. The organization is then
// resolved from the verified JWT, never from the request.
router.use(authenticateUser);

/**
 * @openapi
 * /api/v1/recordings:
 *   post:
 *     summary: Create a Recording (PENDING)
 *     description: >
 *       Creates the metadata record and returns it. The storage key is generated
 *       server-side from the caller's organization and this recording's id, so a
 *       client can never address another tenant's object. The declared
 *       contentType is validated against the allowlist but is later replaced by
 *       the authoritative value read from HeadObject at complete().
 *     tags:
 *       - Recordings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType]
 *             properties:
 *               contentType:
 *                 type: string
 *                 example: video/webm;codecs=vp8,opus
 *               projectId:
 *                 type: string
 *               meetingId:
 *                 type: string
 *                 description: Opaque id. The Meeting domain does not exist yet.
 *     responses:
 *       201:
 *         description: Recording created
 *       400:
 *         description: Invalid content type or too many pending recordings
 *       404:
 *         description: Project not found in this organization
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const recording = await createRecording(req, res);
    return recording;
  })
);

/**
 * @openapi
 * /api/v1/recordings:
 *   get:
 *     summary: List Recordings for the organization
 *     tags:
 *       - Recordings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, READY, FAILED, DELETED]
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated recordings
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const recordings = await getRecordings(req, res);
    return recordings;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}:
 *   get:
 *     summary: Get a Recording by id
 *     description: Tenant scoped. A recording from another organization returns 404.
 *     tags:
 *       - Recordings
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
 *         description: Recording metadata (never includes storage_key)
 *       404:
 *         description: Recording not found
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const recording = await getRecordingById(req, res);
    return recording;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}/upload-url:
 *   post:
 *     summary: Issue a presigned PUT URL for the recording
 *     description: >
 *       Signs the server-derived storage key. Repeatable, so a failed upload can
 *       be retried without creating a new recording. Rejected once the recording
 *       is no longer PENDING.
 *     tags:
 *       - Recordings
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
 *         description: Presigned upload URL
 *       400:
 *         description: Recording is not PENDING
 *       404:
 *         description: Recording not found
 */
router.post(
  '/:id/upload-url',
  asyncHandler(async (req, res) => {
    const result = await getRecordingUploadUrl(req, res);
    return result;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}/complete:
 *   post:
 *     summary: Finalize an upload and mark the recording READY
 *     description: >
 *       Reads the object with HeadObject and treats its ContentType and
 *       ContentLength as authoritative. Anything the client declared or claimed
 *       about its own upload is not trusted. An object that is empty, too large,
 *       or of an unsupported type is deleted and the recording marked FAILED.
 *     tags:
 *       - Recordings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               durationMs:
 *                 type: number
 *                 example: 60210
 *                 description: Measured by MediaRecorder. Advisory, clamped to the 60s cap.
 *     responses:
 *       200:
 *         description: Recording completed
 *       400:
 *         description: Object missing, empty, too large, or wrong type
 *       404:
 *         description: Recording not found
 */
router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const recording = await completeRecording(req, res);
    return recording;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}/download-url:
 *   post:
 *     summary: Issue a short-lived presigned GET URL
 *     description: >
 *       The bucket is private; this URL is the capability. Requires READY.
 *     tags:
 *       - Recordings
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
 *         description: Presigned download URL
 *       400:
 *         description: Recording is not READY
 *       404:
 *         description: Recording or file not found
 */
router.post(
  '/:id/download-url',
  asyncHandler(async (req, res) => {
    const result = await getRecordingDownloadUrl(req, res);
    return result;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}:
 *   delete:
 *     summary: Delete a Recording
 *     description: >
 *       Deletes the stored object and soft deletes the record. Permitted for the
 *       recording owner or an organization SuperAdmin.
 *     tags:
 *       - Recordings
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
 *         description: Recording deleted
 *       403:
 *         description: Not the owner and not an admin
 *       404:
 *         description: Recording not found
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await deleteRecording(req, res);
    return result;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}/transcript:
 *   get:
 *     summary: Get the transcript for a recording
 *     description: >
 *       Tenant scoped. Returns 404 until a transcript exists. The stored
 *       transcript is always derived from the recording by the local STT
 *       service; browser speech recognition is never persisted.
 *     tags:
 *       - Recordings
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
 *         description: Transcript
 *       404:
 *         description: Recording or transcript not found
 */
router.get(
  '/:id/transcript',
  asyncHandler(async (req, res) => {
    const transcript = await getRecordingTranscript(req, res);
    return transcript;
  })
);

/**
 * @openapi
 * /api/v1/recordings/{id}/summary:
 *   get:
 *     summary: Get the AI summary for a recording
 *     description: >
 *       Tenant scoped. Returns 404 until a summary exists. The summary is
 *       generated locally and constrained to facts present in the transcript.
 *     tags:
 *       - Recordings
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
 *         description: Structured summary
 *       404:
 *         description: Recording or summary not found
 */
router.get(
  '/:id/summary',
  asyncHandler(async (req, res) => {
    const summary = await getRecordingSummary(req, res);
    return summary;
  })
);

export default router;
