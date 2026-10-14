import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam
} from '../controllers/team.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.use(authenticateUser);

/**
 * @openapi
 * /api/v1/teams:
 *   get:
 *     summary: List Organization Teams
 *     description: Returns every team belonging to the authenticated user's organization, newest first, with parent project, hosts and members populated. Note this endpoint is not paginated — it returns the full set. Optionally narrow to one project.
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Restrict to teams under one project. Accepts a Mongo ObjectId or a project code.
 *     responses:
 *       200:
 *         description: Teams retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(getTeams));

/**
 * @openapi
 * /api/v1/teams/{teamId}:
 *   get:
 *     summary: Get Team Details By ID or Code
 *     description: Retrieves a single team scoped to the caller's organization. Accepts either the Mongo ObjectId or the human-readable team code (case-insensitive). A code belonging to another organization returns 404.
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or team code, e.g. `TEAM-0001`.
 *     responses:
 *       200:
 *         description: Team retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Team not found
 */
router.get('/:teamId', asyncHandler(getTeamById));

/**
 * @openapi
 * /api/v1/teams:
 *   post:
 *     summary: Create Team (SuperAdmin or Admin Only)
 *     description: Creates a team under a parent project. `teamName` and `projectId` are both required, and a sequential `team_code` is generated automatically. Every id in `members` and `hosts` must already be assigned to the parent project — selecting anyone outside that roster is rejected with 400. The organization is taken from the caller's token, never from the request body.
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamName, projectId]
 *             properties:
 *               teamName:
 *                 type: string
 *                 example: Mobile Squad
 *               description:
 *                 type: string
 *                 example: Owns the v2 mobile client.
 *               projectId:
 *                 type: string
 *                 description: Mongo ObjectId or project code of the parent project.
 *               teamStatus:
 *                 type: string
 *                 enum: [active, completed, archived]
 *                 default: active
 *               hosts:
 *                 type: array
 *                 description: User ObjectIds assigned as team hosts. Must already be on the parent project.
 *                 items:
 *                   type: string
 *               members:
 *                 type: array
 *                 description: User ObjectIds assigned as team members. Must already be on the parent project.
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Validation failed (missing name or project, or a member not assigned to the parent project)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Parent project not found in this organization
 */
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createTeam));

/**
 * @openapi
 * /api/v1/teams/{teamId}:
 *   patch:
 *     summary: Update Team (SuperAdmin or Admin Only)
 *     description: Partially updates a team scoped to the caller's organization. Only fields present in the body are changed. When `hosts` or `members` are supplied, the new roster is re-validated against the parent project and any id not on that project is rejected. Accepts the Mongo ObjectId or the team code.
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or team code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamName:
 *                 type: string
 *               description:
 *                 type: string
 *               teamStatus:
 *                 type: string
 *                 enum: [active, completed, archived]
 *               hosts:
 *                 type: array
 *                 items:
 *                   type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Team updated successfully
 *       400:
 *         description: Validation failed (a member is not assigned to the parent project)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Team not found
 */
router.patch('/:teamId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateTeam));

/**
 * @openapi
 * /api/v1/teams/{teamId}:
 *   delete:
 *     summary: Delete Team (SuperAdmin Only)
 *     description: Permanently removes a team scoped to the caller's organization. Accepts the Mongo ObjectId or the team code. Returns a null data payload with a success envelope.
 *     tags:
 *       - Teams
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or team code.
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin role required)
 *       404:
 *         description: Team not found
 */
router.delete('/:teamId', authorizeRoles('SuperAdmin'), asyncHandler(deleteTeam));

export default router;