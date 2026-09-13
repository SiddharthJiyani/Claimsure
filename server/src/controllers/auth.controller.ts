/**
 * Auth controller — handles signup, login, logout, and session.
 * Proxies to Supabase Auth; enriches profile table on signup.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../database/supabase.js';
import { createProfile, upsertProfile } from '../database/queries/profiles.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { AuthenticationError, ConflictError } from '../lib/errors.js';
import type { SignUpInput, LoginInput, ResetPasswordInput } from '../validators/auth.validator.js';

export async function signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as SignUpInput;

    // 1. Create auth user in Supabase
    const { data, error } = await supabaseAnon.auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new ConflictError('An account with this email already exists');
      }
      throw new AuthenticationError(error.message);
    }

    if (!data.user) throw new AuthenticationError('Failed to create user');

    // 2. Create profile row (role + org)
    const profile = await createProfile({
      id: data.user.id,
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      organization_id: body.organization_id,
    });

    sendCreated(res, {
      user: {
        id: data.user.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        organization_id: profile.organization_id,
      },
      session: data.session,
    }, 'Account created. Please check your email for verification.');
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as LoginInput;

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.session) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Upsert profile (handles edge cases where profile may not exist yet)
    await upsertProfile({
      id: data.user.id,
      email: data.user.email ?? body.email,
      full_name: data.user.user_metadata?.['full_name'] as string ?? 'Unknown',
      role: data.user.user_metadata?.['role'] as 'patient' | 'insurance_provider' ?? 'patient',
    });

    sendSuccess(res, {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Bearer token required');
    }

    await supabaseAnon.auth.signOut();
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user is already populated by the auth middleware
    sendSuccess(res, req.user);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as ResetPasswordInput;

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${process.env['CORS_ALLOWED_ORIGINS']?.split(',')[0]}/reset-password`,
    });

    if (error) throw new AuthenticationError(error.message);

    // Always return 200 (don't reveal if email exists)
    sendSuccess(res, null, 'If this email exists, a reset link has been sent.');
  } catch (err) {
    next(err);
  }
}
