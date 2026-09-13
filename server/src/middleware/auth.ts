import type { NextFunction, Request, Response } from "express";
import { getAnonClient, getServiceClient } from "../database/supabase.js";
import { HttpError } from "./error-handler.js";
import type { AuthedRequest, Profile } from "../types.js";
import { isUserRole } from "../types.js";

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function loadSession(req: Request) {
  const token = readBearer(req);
  if (!token) {
    throw new HttpError(401, "Missing Authorization bearer token");
  }

  const { data, error } = await getAnonClient().auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired session");
  }

  const { data: profile, error: profileError } = await getServiceClient()
    .from("profiles")
    .select("id, email, full_name, role, organization_id, created_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(500, "Failed to load profile", profileError.message);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? profile?.email ?? "",
    profile: profile && isUserRole(profile.role) ? (profile as Profile) : null,
  };
}

export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const session = await loadSession(req);
    (req as AuthedRequest).user = {
      id: session.id,
      email: session.email,
      profile: session.profile as Profile,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const session = await loadSession(req);
    if (!session.profile) {
      throw new HttpError(
        403,
        "Profile is incomplete. Finish role selection first.",
      );
    }
    (req as AuthedRequest).user = {
      id: session.id,
      email: session.email,
      profile: session.profile,
    };
    next();
  } catch (err) {
    next(err);
  }
}
