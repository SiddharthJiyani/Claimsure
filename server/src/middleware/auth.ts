/**
 * Auth middleware — validates Supabase JWT from the Authorization header.
 * Attaches the verified user to req.user for downstream use.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../database/supabase.js';
import { getProfileById } from '../database/queries/profiles.js';
import { AuthenticationError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';

// Extend Express Request with our user type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * requireAuth — verifies the Bearer JWT and attaches req.user.
 * Throws AuthenticationError if the token is missing or invalid.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Bearer token required');
    }

    const token = authHeader.slice(7);

    // Verify token against Supabase
    const {
      data: { user },
      error,
    } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Load profile (role + org) from DB
    const profile = await getProfileById(user.id);

    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      organization_id: profile.organization_id,
      full_name: profile.full_name,
    };

    next();
  } catch (err) {
    next(err);
  }
}
