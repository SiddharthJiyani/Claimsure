/**
 * Auth controller — handles signup, login, logout, and session.
 * Uses Supabase Admin client for signup to bypass email rate limits in dev.
 * Production: switch signUp back to getAnonClient() and enable email confirmation in Supabase dashboard.
 */

import type { Request, Response, NextFunction } from 'express';
import { getAnonClient, getServiceClient } from '../database/supabase.js';
import { upsertProfile, createProfile, getProfileById } from '../database/queries/profiles.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { AuthenticationError, ConflictError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';
import type { SignUpInput, LoginInput, ResetPasswordInput } from '../validators/auth.validator.js';

export async function signUp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as SignUpInput;

    // Use admin.createUser so we can:
    // 1. Skip email confirmation (email_confirm: true) — avoids Supabase rate limits in dev
    // 2. Store full_name and role in user_metadata for the login flow to reference
    const { data, error } = await getServiceClient().auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique')) {
        throw new ConflictError('An account with this email already exists');
      }
      throw new AuthenticationError(error.message);
    }

    if (!data.user) throw new AuthenticationError("Failed to create user");

    // Resolve organization_id for insurance_provider accounts
    let organization_id: string | undefined = body.organization_id;
    if (!organization_id && body.role === 'insurance_provider' && body.organization_name) {
      const { data: orgData, error: orgError } = await getServiceClient()
        .from('organizations')
        .insert({ name: body.organization_name, type: 'insurance_provider' })
        .select('id')
        .single();
      if (orgError || !orgData) {
        throw new Error('Failed to create organization: ' + (orgError?.message ?? 'unknown'));
      }
      organization_id = orgData.id as string;
    }

    // Upsert the profile row — the Supabase trigger may have already created it
    const profile = await upsertProfile({
      id: data.user.id,
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      ...(organization_id !== undefined ? { organization_id } : {}),
    });

    sendCreated(
      res,
      {
        user: {
          id: data.user.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          organization_id: profile.organization_id,
        },
        session: null,
      },
      "Account created. You can log in immediately."
    );
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as LoginInput;

    const { data, error } = await getAnonClient().auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.session) {
      throw new AuthenticationError("Invalid email or password");
    }

    let profile;
    try {
      profile = await getProfileById(data.user.id);
    } catch (err) {
      // Fallback: create if missing
      profile = await createProfile({
        id: data.user.id,
        email: data.user.email ?? body.email,
        full_name: data.user.user_metadata?.['full_name'] as string ?? 'Unknown',
        role: data.user.user_metadata?.['role'] as 'patient' | 'insurance_provider' ?? 'patient',
      });
    }

    sendSuccess(
      res,
      {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
        },
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role,
          organization_id: profile.organization_id,
        },
      },
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AuthenticationError("Bearer token required");
    }

    await getAnonClient().auth.signOut();
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user is already populated by the auth middleware
    sendSuccess(res, req.user as AuthUser);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as ResetPasswordInput;

    const { error } = await getAnonClient().auth.resetPasswordForEmail(body.email, {
      redirectTo: `${process.env['CORS_ALLOWED_ORIGINS']?.split(',')[0]}/reset-password`,
    });

    if (error) throw new AuthenticationError(error.message);

    // Always return 200 (don't reveal if email exists)
    sendSuccess(res, null, "If this email exists, a reset link has been sent.");
  } catch (err) {
    next(err);
  }
}
