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

/**
 * @openapi
 * /api/v1/tasks:
 *   get:
 *     summary: List Organization Tasks
 *     description: Returns every task belonging to the authenticated user's organization, newest first, with project, team, assignee and audit fields populated. All filters are optional and combine with AND. Note this endpoint is not paginated — it returns the full filtered set.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Restrict to tasks on one project (Mongo ObjectId).
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *         description: Restrict to tasks assigned to one team (Mongo ObjectId).
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [to_do, in_progress, bug, backlog, completed]
 *         description: Restrict to one task status.
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(getTasks));

/**
 * @openapi
 * /api/v1/tasks/{taskId}:
 *   get:
 *     summary: Get Task Details By ID or Code
 *     description: Retrieves a single task scoped to the caller's organization. Accepts either the Mongo ObjectId or the human-readable task code (case-insensitive). Lookups by a code belonging to another organization return 404.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or task code, e.g. `TASK-0001`.
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.get('/:taskId', asyncHandler(getTaskById));

/**
 * @openapi
 * /api/v1/tasks:
 *   post:
 *     summary: Create Task (SuperAdmin or Admin Only)
 *     description: Creates a task in the caller's organization. A sequential `task_code` is generated automatically, so it must not be supplied. `taskTitle` is required. The organization is taken from the caller's token, never from the request body. Project and team assignments are optional.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskTitle]
 *             properties:
 *               taskTitle:
 *                 type: string
 *                 example: Fix upload progress bar
 *               taskDescription:
 *                 type: string
 *                 example: Progress bar stalls at 90% on large files.
 *               taskStatus:
 *                 type: string
 *                 enum: [to_do, in_progress, bug, backlog, completed]
 *                 default: to_do
 *               assignedMembers:
 *                 type: array
 *                 description: User ObjectIds to assign as assignees.
 *                 items:
 *                   type: string
 *               projectId:
 *                 type: string
 *                 description: Optional Mongo ObjectId of the parent project.
 *               teamId:
 *                 type: string
 *                 description: Optional Mongo ObjectId of the parent team.
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation failed (missing task title)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 */
router.post('/', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(createTask));

/**
 * @openapi
 * /api/v1/tasks/{taskId}:
 *   patch:
 *     summary: Update Task (SuperAdmin or Admin Only)
 *     description: Partially updates a task scoped to the caller's organization. Only the fields present in the body are changed; omitted fields are left untouched. The caller is recorded as `updated_by`. Accepts the Mongo ObjectId or the task code.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or task code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskTitle:
 *                 type: string
 *               taskDescription:
 *                 type: string
 *               taskStatus:
 *                 type: string
 *                 enum: [to_do, in_progress, bug, backlog, completed]
 *               assignedMembers:
 *                 type: array
 *                 items:
 *                   type: string
 *               projectId:
 *                 type: string
 *               teamId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Task not found
 */
router.patch('/:taskId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateTask));

/**
 * @openapi
 * /api/v1/tasks/{taskId}:
 *   delete:
 *     summary: Delete Task (SuperAdmin or Admin Only)
 *     description: Permanently removes a task scoped to the caller's organization. Accepts the Mongo ObjectId or the task code. Returns a null data payload with a success envelope.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or task code.
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Task not found
 */
router.delete('/:taskId', authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(deleteTask));

export default router;