import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createTeam,
  getTeams,
  updateTeam,
  deleteTeam
} from '../controllers/team.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(getTeams));
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createTeam));
router.patch('/:teamId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateTeam));
router.delete('/:teamId', authorizeRoles('SuperAdmin'), asyncHandler(deleteTeam));

export default router;
