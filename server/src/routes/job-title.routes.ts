import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';
import {
  listJobTitles,
  createJobTitle,
  updateJobTitle,
  deleteJobTitle,
  assignJobTitle,
} from '../controllers/job-title.controller.js';

const router: Router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(listJobTitles));
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createJobTitle));
router.put('/:id', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateJobTitle));
router.delete('/:id', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(deleteJobTitle));
router.post('/assign', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(assignJobTitle));

export default router;
