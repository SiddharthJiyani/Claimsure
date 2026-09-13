/**
 * Auth middleware — validates Supabase JWT and populates req.user.
 * Use requireAuth on any route that needs an authenticated user.
 * Use requireSession for routes that just need a valid token (no profile required).
 */

import type { NextFunction, Request, Response } from 'express';
import { getAnonClient, getServiceClient } from '../database/supabase.js';
import { AuthenticationError, ForbiddenError } from '../lib/errors.js';
import type { AuthUser, UserRole } from '../types/index.js';

// ─── Express Request Augmentation ────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function loadSession(req: Request): Promise<AuthUser> {
  const token = readBearer(req);
  if (!token) {
    throw new AuthenticationError('Missing Authorization bearer token');
  }

  const { data, error } = await getAnonClient().auth.getUser(token);
  if (error || !data.user) {
    throw new AuthenticationError('Invalid or expired session');
  }

  const { data: profile, error: profileError } = await getServiceClient()
    .from('profiles')
    .select('id, email, full_name, role, organization_id, created_at')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AuthenticationError(`Failed to load profile: ${profileError.message}`);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? profile?.email ?? '',
    full_name: profile?.full_name ?? '',
    role: (profile?.role ?? 'patient') as UserRole,
    organization_id: profile?.organization_id ?? null,
  };
}

// ─── Exported Middleware ───────────────────────────────────────────────────────

/**
 * requireSession — validates the JWT and populates req.user.
 * Does NOT require a complete profile. Use for profile-creation endpoints.
 */
export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.user = await loadSession(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireAuth — validates the JWT, loads the profile, and requires it to be complete.
 * Use this on all protected routes.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await loadSession(req);
    if (!user.full_name) {
      throw new ForbiddenError('Profile is incomplete. Finish role selection first.');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
