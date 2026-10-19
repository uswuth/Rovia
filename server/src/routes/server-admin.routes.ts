import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  loginServerAdmin,
  getServerMetrics,
  createOrgWithCredentials,
  listAllOrganizationsServerAdmin,
  getOrgDetailsServerAdmin,
  updateOrgServerAdmin,
  deleteOrgServerAdmin
} from '../controllers/server-admin.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/server-admin/login:
 *   post:
 *     summary: Server Admin Login
 *     description: Authenticates a Server Admin and returns a short-lived access token for the control plane. `username` accepts either the username or the registered email address. If no Server Admin exists yet, one is seeded on first successful call using `SERVER_ADMIN_INITIAL_PASSWORD` from the environment, or a randomly generated password written to the server log. Also reachable at the `/api/v0/server-admin/login` alias.
 *     tags:
 *       - Server Admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: serveradmin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: your-password
 *     responses:
 *       200:
 *         description: Login successful; returns the admin profile and an access token
 *       400:
 *         description: Username and password are required
 *       401:
 *         description: Invalid Server Admin credentials
 */
router.post('/server-admin/login', asyncHandler(loginServerAdmin));

/**
 * @openapi
 * /api/v1/server-admin/metrics:
 *   get:
 *     summary: Get Platform Metrics (ServerAdmin Only)
 *     description: Returns platform-wide counters — organization, user and active-user totals — alongside process uptime and heap usage. Observability fields such as `activeConnections`, `apiLatencyMs`, `prometheusStatus` and `grafanaStatus` are placeholders with randomized values and must not be treated as real telemetry. Also reachable at the `/api/v0/server-admin/metrics` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server metrics retrieved successfully
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 */
router.get('/server-admin/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));

/**
 * @openapi
 * /api/v1/server-admin/organizations:
 *   get:
 *     summary: List All Organizations (ServerAdmin Only)
 *     description: Returns every organization across the whole platform, not scoped to any single tenant. Use this to enumerate tenants before calling the per-organization detail endpoint. Also reachable at the `/api/v0/server-admin/organizations` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All organizations listed
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 */
router.get('/server-admin/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(listAllOrganizationsServerAdmin));

/**
 * @openapi
 * /api/v1/server-admin/organizations/{orgId}:
 *   get:
 *     summary: Get Organization Details And Counts (ServerAdmin Only)
 *     description: Returns one organization with its owner populated, plus live counts of its members, projects, teams, meetings and tasks. Soft-deleted records are excluded from every count. Also reachable at the `/api/v0/server-admin/organizations/{orgId}` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *           description: Mongo ObjectId of the organization.
 *     responses:
 *       200:
 *         description: Organization details retrieved successfully
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 *       404:
 *         description: Organization not found
 */
router.get('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getOrgDetailsServerAdmin));

/**
 * @openapi
 * /api/v1/server-admin/organizations:
 *   post:
 *     summary: Create Organization With Initial Admin Credentials (ServerAdmin Only)
 *     description: Creates a new tenant organization together with its first `SuperAdmin` user in a single call. A cryptographically random password is generated server-side and returned **once, in plaintext, in this response only** — it is not stored in recoverable form and there is no endpoint to retrieve it again, so surface it to the operator immediately. The slug is derived from the organization name and disambiguated with a timestamp suffix on collision. Also reachable at the `/api/v0/server-admin/organizations` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationName, adminEmail]
 *             properties:
 *               organizationName:
 *                 type: string
 *                 example: Acme Corp
 *               organizationLocation:
 *                 type: string
 *                 example: Berlin, Germany
 *               organizationDescription:
 *                 type: string
 *                 example: Enterprise customer tenant.
 *               adminName:
 *                 type: string
 *                 description: Display name for the first SuperAdmin. Defaults to the organization name plus "Admin".
 *                 example: Jane Doe
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 description: Login email for the first SuperAdmin. Stored lowercased.
 *                 example: jane.doe@acme.example
 *     responses:
 *       201:
 *         description: Organization created and initial credentials generated
 *       400:
 *         description: Validation failed (missing organization name or admin email)
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 */
router.post('/server-admin/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(createOrgWithCredentials));

/**
 * @openapi
 * /api/v1/server-admin/organizations/{orgId}:
 *   patch:
 *     summary: Update Organization (ServerAdmin Only)
 *     description: Partially updates an organization's name, location or description. Only fields present in the body are changed. The organization's slug is not editable here. Also reachable at the `/api/v0/server-admin/organizations/{orgId}` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the organization.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName:
 *                 type: string
 *                 organizationLocation:
 *                 type: string
 *                 organizationDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 *       404:
 *         description: Organization not found
 */
router.patch('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(updateOrgServerAdmin));

/**
 * @openapi
 * /api/v1/server-admin/organizations/{orgId}:
 *   delete:
 *     summary: Delete Organization And All Tenant Data (ServerAdmin Only)
 *     description: >
 *       Permanently destroys an organization and every tenant-scoped record
 *       under it — meetings, polls, questions, recordings, summaries,
 *       transcripts, tasks, teams, projects, work roles and users. This cascade
 *       is not reversible and there is no soft-delete or recovery path. Do not
 *       call this without an explicit confirmation step in the UI. Also
 *       reachable at the `/api/v0/server-admin/organizations/{orgId}` alias.
 *     tags:
 *       - Server Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mongo ObjectId of the organization.
 *     responses:
 *       200:
 *         description: Organization and all associated tenant resources permanently deleted
 *       401:
 *         description: Unauthorized, or the token's identity is not a verified Server Admin
 *       403:
 *         description: Forbidden (ServerAdmin role required)
 *       404:
 *         description: Organization not found
 */
router.delete('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(deleteOrgServerAdmin));

export default router;