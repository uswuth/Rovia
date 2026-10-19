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
router.post('/login', asyncHandler(loginServerAdmin));
router.post('/server-admin/login', asyncHandler(loginServerAdmin));

router.get('/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));
router.post('/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));
router.get('/server-admin/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));
router.post('/server-admin/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));

router.get('/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(listAllOrganizationsServerAdmin));
router.post('/organizations/list', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(listAllOrganizationsServerAdmin));
router.get('/server-admin/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(listAllOrganizationsServerAdmin));

router.get('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getOrgDetailsServerAdmin));
router.post('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getOrgDetailsServerAdmin));
router.get('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getOrgDetailsServerAdmin));
router.post('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getOrgDetailsServerAdmin));

router.post('/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(createOrgWithCredentials));
router.post('/server-admin/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(createOrgWithCredentials));

router.patch('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(updateOrgServerAdmin));
router.patch('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(updateOrgServerAdmin));

router.delete('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(deleteOrgServerAdmin));
router.delete('/server-admin/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(deleteOrgServerAdmin));

export default router;