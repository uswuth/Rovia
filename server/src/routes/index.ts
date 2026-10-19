import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import organizationRouter from './organization.routes.js';
import projectRouter from './project.routes.js';
import recordingRouter from './recording.routes.js';
import meetingRouter from './meeting.routes.js';
import meetingQaPollRouter from './meeting-qa-poll.routes.js';
import serverAdminRouter from './server-admin.routes.js';
import workRoleRouter from './work-role.routes.js';
import userDetailsRouter from './user-details.routes.js';
import teamRouter from './team.routes.js';
import taskRouter from './task.routes.js';

const router: Router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/user-details', userDetailsRouter);
router.use('/organizations', organizationRouter);
router.use('/work-roles', workRoleRouter);
router.use('/projects', projectRouter);
router.use('/teams', teamRouter);
router.use('/tasks', taskRouter);
router.use('/recordings', recordingRouter);
router.use('/server-admin', serverAdminRouter);



// Meeting routes. Q&A and polls share the /meetings prefix.
router.use('/meetings', meetingRouter);
router.use('/meetings', meetingQaPollRouter);

export default router;
