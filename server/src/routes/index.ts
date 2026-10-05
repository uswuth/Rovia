import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import organizationRouter from './organization.routes.js';
import projectRouter from './project.routes.js';
import recordingRouter from './recording.routes.js';
import meetingRouter from './meeting.routes.js';
import meetingQaPollRouter from './meeting-qa-poll.routes.js';
import jobTitleRouter from './job-title.routes.js';

const router: Router = Router();

// Version 1 API routes
router.use('/v1/health', healthRouter);
router.use('/v1/auth', authRouter);
router.use('/v1/organizations', organizationRouter);
router.use('/v1/job-titles', jobTitleRouter);
router.use('/v1/projects', projectRouter);
router.use('/v1/recordings', recordingRouter);
// Meeting routes. Q&A and polls share the /meetings prefix.
router.use('/v1/meetings', meetingRouter);
router.use('/v1/meetings', meetingQaPollRouter);

export default router;
