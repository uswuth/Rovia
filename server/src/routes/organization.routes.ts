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
 *     summary: Get Own Organization (SuperAdmin Only)
 *     description: Returns the calling SuperAdmin's own organization only, with its owner populated. Tenant admins cannot enumerate other organizations; the platform-wide list is served by the ServerAdmin control plane (`GET /api/v1/server-admin/organizations`).
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
 *     description: Creates a user inside the caller's own organization with a sequential `user_code`. The target organization always comes from the caller's access token; an `organizationId` in the body that names another tenant is rejected with 403. Email must be unique platform-wide; a duplicate returns 409. When `password` is omitted the server generates one — capture it from the response, as it is not retrievable later.
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
 *                 description: Optional. Must be at least 8 characters with upper case, lower case, a digit and one of `@$!%*?&`. When omitted the server generates a random password and returns it once as `initialPassword` — there is no shared default and it is not retrievable later.
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
 *                 description: Must match the caller's own organization. Any other value is rejected with 403.
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
 *     description: Partially updates a user in the caller's own organization by Mongo ObjectId. Users in another tenant are not found and return 404. Soft-deleted users also return 404. The organization's owner is pinned to `SuperAdmin` and `ACTIVE` regardless of what is submitted, so attempts to demote or deactivate an owner are silently ignored. A user cannot be moved to another organization.
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
 *     description: Lists non-deleted users in the caller's own organization with their organization populated and with `password` and `refresh_token` excluded. The list is always tenant-scoped, for `Admin` and `SuperAdmin` alike; `organizationId` in the query is not honoured.
 *     tags:
 *       - Organizations
 *     security:
 *       - bearerAuth: []
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



