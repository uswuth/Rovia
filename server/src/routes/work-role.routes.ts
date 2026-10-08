import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createWorkRole,
  getWorkRoles,
  updateWorkRole,
  deleteWorkRole
} from '../controllers/work-role.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(getWorkRoles));
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createWorkRole));
router.patch('/:roleId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateWorkRole));
router.delete('/:roleId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(deleteWorkRole));

export default router;
