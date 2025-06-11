// src/routes/profileRoutes.ts
import { Router, Response, NextFunction } from 'express';
import { verifyToken } from '@middleware/authMiddleware'; // Path alias
import { checkRoles } from '@middleware/rbacMiddleware'; // Path alias
import { AuthenticatedRequest } from '@src/types/express.d'; // Path alias
import { UserProfile } from '@adapters/userStoreAdapter'; // Path alias

const router = Router();

/**
 * @fileoverview Routes for user profile, protected by JWT authentication and RBAC.
 */

/**
 * @route GET /auth/profile
 * @description Retrieves the profile of the authenticated user.
 * Requires a valid JWT in the Authorization header (Bearer token).
 * @access Private
 * @middleware verifyToken - Ensures the user is authenticated.
 */
router.get('/profile', verifyToken, (req: AuthenticatedRequest, res: Response) => {
  // If verifyToken middleware succeeds, req.user will be populated and typed.
  if (!req.user) {
    // This case should ideally be caught by verifyToken if token is invalid/missing,
    // or by JWT strategy if user not found. But as a safeguard:
    return res.status(401).json({ message: 'Unauthorized. User not found in request.' });
  }

  // Return the user's profile information.
  // req.user is of type UserProfile (or undefined if not AuthenticatedRequest)
  const userProfile: UserProfile = req.user;
  res.json({
    message: 'Profile retrieved successfully!',
    user: userProfile
  });
});

/**
 * @route GET /auth/admin/dashboard
 * @description Example admin-only route.
 * Requires a valid JWT and 'admin' role.
 * @access Private (Admin)
 * @middleware verifyToken - Ensures user is authenticated.
 * @middleware checkRoles('admin') - Ensures user has 'admin' role.
 */
router.get(
  '/admin/dashboard',
  verifyToken,
  checkRoles('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    // req.user is guaranteed to exist here due to verifyToken and checkRoles.
    const adminUser = req.user as UserProfile; // Type assertion if needed, though AuthenticatedRequest types it.

    res.json({
      message: 'Welcome to the Admin Dashboard!',
      adminDetails: {
        userId: adminUser.id,
        email: adminUser.email,
        roles: adminUser.roles,
      }
    });
  }
);

export default router;
