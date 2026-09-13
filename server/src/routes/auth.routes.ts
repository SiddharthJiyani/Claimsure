import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import {
  signUp,
  login,
  logout,
  getMe,
  resetPassword,
} from "../controllers/auth.controller.js";
import {
  signUpSchema,
  loginSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

/**
 * POST /api/auth/signup
 * Create a new account (patient or insurance_provider).
 * Body: { email, password, full_name, role, organization_id? }
 */
router.post("/signup", validate(signUpSchema), signUp);

/**
 * POST /api/auth/login
 * Authenticate and receive a JWT session token.
 * Body: { email, password }
 */
router.post("/login", validate(loginSchema), login);

/**
 * POST /api/auth/logout
 * Invalidate the current session.
 * Headers: Authorization: Bearer <token>
 */
router.post("/logout", requireAuth, logout);

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile (role, org).
 * Headers: Authorization: Bearer <token>
 */
router.get("/me", requireAuth, getMe);

/**
 * POST /api/auth/reset-password
 * Request a password reset email.
 * Body: { email }
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
