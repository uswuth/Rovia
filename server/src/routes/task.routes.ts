import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask
} from '../controllers/task.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(getTasks));
router.get('/:taskId', asyncHandler(getTaskById));
router.post('/', authorizeRoles('SuperAdmin', 'Admin', 'Host'), asyncHandler(createTask));
router.patch('/:taskId', authorizeRoles('SuperAdmin', 'Admin', 'Host'), asyncHandler(updateTask));
router.delete('/:taskId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(deleteTask));

export default router;
