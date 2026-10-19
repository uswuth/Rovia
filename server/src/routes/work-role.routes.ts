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

/**
 * @openapi
 * /api/v1/work-roles:
 *   get:
 *     summary: List Organization Work Roles
 *     description: Returns every work role defined for the authenticated user's organization, newest first. Work roles are a per-organization catalogue used to describe a user's function (for example "Backend Engineer"). Note this endpoint is not paginated. Returns an empty array when the token carries no organization.
 *     tags:
 *       - Work Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Work roles retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(getWorkRoles));

/**
 * @openapi
 * /api/v1/work-roles:
 *   post:
 *     summary: Create Work Role (SuperAdmin or Admin Only)
 *     description: Creates a work role in the caller's organization. `roleName` is required and a sequential `role_code` is generated automatically, so it must not be supplied. The organization is derived from the caller's token and falls back to `organizationId` in the body only if the token carries none.
 *     tags:
 *       - Work Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleName]
 *             properties:
 *               roleName:
 *                 type: string
 *                 example: Backend Engineer
 *               tagName:
 *                 type: string
 *                 description: Optional short label shown alongside the role.
 *                 example: BE
 *               description:
 *                 type: string
 *                 example: Owns the API and data layer.
 *               organizationId:
 *                 type: string
 *                 description: Fallback organization, used only when the token carries none.
 *     responses:
 *       201:
 *         description: Work role created successfully
 *       400:
 *         description: Validation failed (missing role name or organization)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 */
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createWorkRole));

/**
 * @openapi
 * /api/v1/work-roles/{roleId}:
 *   patch:
 *     summary: Update Work Role (SuperAdmin or Admin Only)
 *     description: Partially updates a work role scoped to the caller's organization. Only fields present in the body are changed. Unlike tasks and teams, the lookup here is by Mongo ObjectId only — task and team codes are not accepted.
 *     tags:
 *       - Work Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the work role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roleName:
 *                 type: string
 *               tagName:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Work role updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Work role not found
 */
router.patch('/:roleId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateWorkRole));

/**
 * @openapi
 * /api/v1/work-roles/{roleId}:
 *   delete:
 *     summary: Delete Work Role (SuperAdmin or Admin Only)
 *     description: Permanently removes a work role scoped to the caller's organization. Lookup is by Mongo ObjectId only. Returns a null data payload with a success envelope.
 *     tags:
 *       - Work Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the work role.
 *     responses:
 *       200:
 *         description: Work role deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Work role not found
 */
router.delete('/:roleId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(deleteWorkRole));

export default router;