import { Router } from 'express';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  changePassword,
  syncClerkUser
} from '../controllers/auth.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

/**
 * @openapi
 * /api/v1/auth/signup:
 *   post:
 *     summary: User Signup / Registration
 *     description: Creates a new user account with hashed password and returns access token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userName
 *               - userEmail
 *               - password
 *             properties:
 *               userName:
 *                 type: string
 *                 example: Alex Morgan
 *               userEmail:
 *                 type: string
 *                 example: alex@intellmeet.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *               role:
 *                 type: string
 *                 enum: [SuperAdmin, Member]
 *                 example: Member
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 */
router.post('/signup', authRateLimiter, asyncHandler(registerUser));

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: User Login
 *     description: Authenticates user credentials, sets HTTP-only refresh cookie, and returns access token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userEmail
 *               - password
 *             properties:
 *               userEmail:
 *                 type: string
 *                 example: alex@intellmeet.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */
router.post('/login', authRateLimiter, asyncHandler(loginUser));

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Refresh Access Token
 *     description: Rotates refresh token and generates a new 15-minute access token.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', asyncHandler(refreshAccessToken));

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: User Logout
 *     description: Invalidates refresh token and clears HTTP-only cookie.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', asyncHandler(logoutUser));

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Get Current Authenticated User Profile
 *     description: Protected route returning profile information for the Bearer-authenticated user.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Unauthorized / Missing token
 */
router.get('/me', authenticateUser, asyncHandler(getCurrentUser));

/**
 * @openapi
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change Password For Current User
 *     description: >
 *       Changes the authenticated user's own password. Both fields are
 *       required, and `currentPassword` must match the stored hash. `newPassword`
 *       must be at least 8 characters and contain at least one uppercase
 *       letter, one lowercase letter, one digit, and one special character from
 *       @$!%*?& — otherwise the request is rejected with a field-level error.
 *       Returns a null data payload on success.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: The user's existing password.
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Must satisfy the complexity policy described above.
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: >
 *           Validation failed — missing fields, incorrect current password, or
 *           new password failing the complexity policy. Field-level detail is
 *           returned in the `errors` array.
 *       401:
 *         description: Unauthorized / Missing token
 *       404:
 *         description: User not found
 */
router.post('/change-password', authenticateUser, asyncHandler(changePassword));

/**
 * @openapi
 * /api/v1/auth/clerk-sync:
 *   post:
 *     summary: Verify Clerk Authenticated User and Synchronize Organization Session
 *     description: >
 *       Accepts the Clerk session token (and user email), confirms that the verified
 *       email belongs to a valid, registered user in the organization, and issues
 *       the platform's access and refresh tokens. If not registered, returns 403 Forbidden.
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Successfully synchronized and returned application session
 *       403:
 *         description: User email is not registered in an organization
 */
router.post('/clerk-sync', asyncHandler(syncClerkUser));

export default router;
