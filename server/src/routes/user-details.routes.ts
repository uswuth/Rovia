import { Router } from 'express';
import {
  getUserDetails,
  updateUserDetails
} from '../controllers/user-details.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/user-details:
 *   get:
 *     summary: Get Current User Extended Details
 *     description: Retrieve extended profile, contact, address, and privacy settings for the current user.
 *     tags:
 *       - UserDetails
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *   put:
 *     summary: Update Current User Extended Details
 *     description: Update user profile, contact, emergency info, avatar, and preference settings.
 *     tags:
 *       - UserDetails
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details updated successfully
 */
router.use(authenticateUser);
router.get('/', asyncHandler(getUserDetails));
router.put('/', asyncHandler(updateUserDetails));

export default router;
