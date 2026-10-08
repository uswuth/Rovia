import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getMyOrganization,
  getOrganizationMembers,
  getOrganizationMemberById,
  createOrganization,
  getAllOrganizations,
  provisionUser,
  updateUserAdmin,
  getAllUsersAdmin
} from '../controllers/organization.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.post('/', authenticateUser, authorizeRoles('SuperAdmin'), asyncHandler(createOrganization));
router.get('/', authenticateUser, authorizeRoles('SuperAdmin'), asyncHandler(getAllOrganizations));
router.post('/users/provision', authenticateUser, authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(provisionUser));
router.patch('/users/:userId', authenticateUser, authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateUserAdmin));
router.get('/users/all', authenticateUser, authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(getAllUsersAdmin));

/**
 * @openapi
 * /api/v1/organizations/me:
 *   get:
 *     summary: Get My Organization Profile
 *     description: Returns organization details and owner information for the authenticated user.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization details retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User does not belong to an organization
 */
router.get('/me', authenticateUser, asyncHandler(getMyOrganization));

/**
 * @openapi
 * /api/v1/organizations/members:
 *   get:
 *     summary: List All Organization Members
 *     description: Returns all team members belonging to the authenticated user's organization (for populating members table & assigning hosts/members to projects).
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organization members retrieved successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: User does not belong to any organization
 */
router.get('/members', authenticateUser, asyncHandler(getOrganizationMembers));
router.get('/members/:memberId', authenticateUser, asyncHandler(getOrganizationMemberById));

export default router;



