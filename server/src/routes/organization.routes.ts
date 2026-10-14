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

/**
 * @openapi
 * /api/v1/organizations:
 *   post:
 *     summary: Create Organization (SuperAdmin Only)
 *     description: Creates a new organization record and sets the calling SuperAdmin as its owner. The slug is derived from the organization name and disambiguated with a timestamp suffix if it collides. Unlike the Server Admin control-plane endpoint, this does **not** create a first user for the tenant — provision one separately via `/api/v1/organizations/users/provision`.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationName]
 *             properties:
 *               organizationName:
 *                 type: string
 *                 example: Northwind Traders
 *               organizationLocation:
 *                 type: string
 *                 example: Seattle, USA
 *               organizationDescription:
 *                 type: string
 *                 example: Customer-facing tenant.
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Validation failed (organization name is required)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin role required)
 */
router.post('/', authenticateUser, authorizeRoles('SuperAdmin'), asyncHandler(createOrganization));

/**
 * @openapi
 * /api/v1/organizations:
 *   get:
 *     summary: List All Organizations (SuperAdmin Only)
 *     description: Returns every organization across the platform with its owner populated, newest first. This is not scoped to the caller's own organization, so it is a cross-tenant administrative view.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin role required)
 */
router.get('/', authenticateUser, authorizeRoles('SuperAdmin'), asyncHandler(getAllOrganizations));

/**
 * @openapi
 * /api/v1/organizations/users/provision:
 *   post:
 *     summary: Provision IAM User (SuperAdmin or Admin Only)
 *     description: Creates a user inside a target organization with a sequential `user_code`. The target organization is taken from the caller's token unless the caller is a global SuperAdmin, in which case `organizationId` in the body selects the tenant. Email must be unique platform-wide; a duplicate returns 409. When `password` is omitted the server generates one — capture it from the response, as it is not retrievable later.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userName, userEmail]
 *             properties:
 *               userName:
 *                 type: string
 *                 example: Alex Morgan
 *               userEmail:
 *                 type: string
 *                 format: email
 *                 example: alex.morgan@northwind.example
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Optional. Generated server-side when omitted.
 *               userRole:
 *                 type: string
 *                 example: Member
 *               userStatus:
 *                 type: string
 *                 example: ACTIVE
 *               jobTitle:
 *                 type: string
 *                 example: QA Engineer
 *               organizationId:
 *                 type: string
 *                 description: Target tenant. Honoured only for global SuperAdmins; ignored otherwise.
 *     responses:
 *       201:
 *         description: IAM User provisioned successfully
 *       400:
 *         description: Validation failed (missing name, email or target organization)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: Target Organization not found
 *       409:
 *         description: A user with this email address already exists
 */
router.post('/users/provision', authenticateUser, authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(provisionUser));

/**
 * @openapi
 * /api/v1/organizations/users/{userId}:
 *   patch:
 *     summary: Update User (SuperAdmin or Admin Only)
 *     description: Partially updates a user record by Mongo ObjectId. Soft-deleted users return 404. The organization's owner is pinned to `SuperAdmin` and `ACTIVE` regardless of what is submitted, so attempts to demote or deactivate an owner are silently ignored.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the user. User codes are not accepted here.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *               userEmail:
 *                 type: string
 *                 format: email
 *               userRole:
 *                 type: string
 *                 example: Admin
 *               userStatus:
 *                 type: string
 *                 example: INACTIVE
 *               jobTitle:
 *                 type: string
 *               organizationId:
 *                 type: string
 *                 description: Move the user to a different tenant.
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 *       404:
 *         description: User not found
 */
router.patch('/users/:userId', authenticateUser, authorizeRoles('SuperAdmin', 'Admin'), asyncHandler(updateUserAdmin));

/**
 * @openapi
 * /api/v1/organizations/users/all:
 *   get:
 *     summary: List Users (SuperAdmin or Admin Only)
 *     description: Lists non-deleted users with their organization populated and with `password` and `refresh_token` excluded. Admins are always confined to their own organization. A global SuperAdmin may pass `organizationId` to narrow to one tenant, or omit it to list every user platform-wide.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *         description: Filter to one tenant. Ignored for non-global SuperAdmins, who are already scoped to their own organization.
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin or Admin role required)
 */
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

/**
 * @openapi
 * /api/v1/organizations/members/{memberId}:
 *   get:
 *     summary: Get Organization Member Profile
 *     description: Returns a single member profile scoped to the caller's organization. `memberId` accepts either a Mongo ObjectId or a `user_code` (case-insensitive). **Field visibility is conditional:** a caller viewing their own profile, or any Admin/SuperAdmin, receives the full record; every other caller receives the restricted list projection only. Members outside the caller's organization return 404.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId or user code, e.g. `USR-0001`.
 *     responses:
 *       200:
 *         description: Member profile retrieved successfully
 *       400:
 *         description: User does not belong to any organization
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Member not found in your organization
 */
router.get('/members/:memberId', authenticateUser, asyncHandler(getOrganizationMemberById));

export default router;



