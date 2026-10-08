import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  loginServerAdmin,
  getServerMetrics,
  createOrgWithCredentials,
  listAllOrganizationsServerAdmin,
  updateOrgServerAdmin,
  deleteOrgServerAdmin
} from '../controllers/server-admin.controller.js';
import { authenticateUser, authorizeRoles } from '../middlewares/auth.middleware.js';

const router: Router = Router();

// Fully protected server admin routes
router.post('/login', asyncHandler(loginServerAdmin));

// Requires ServerAdmin role authorization
router.get('/metrics', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(getServerMetrics));
router.get('/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(listAllOrganizationsServerAdmin));
router.post('/organizations', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(createOrgWithCredentials));
router.patch('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(updateOrgServerAdmin));
router.delete('/organizations/:orgId', authenticateUser, authorizeRoles('ServerAdmin'), asyncHandler(deleteOrgServerAdmin));

export default router;
