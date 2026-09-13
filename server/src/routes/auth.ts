import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth, requireSession } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { isUserRole, type AuthedRequest } from "../types.js";

const router = Router();

router.get("/me", requireSession, (req, res) => {
  const { user } = req as AuthedRequest;
  res.json({ user: user.profile ?? null, needs_profile: !user.profile });
});

router.post("/profile", requireSession, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const fullName =
      typeof req.body?.full_name === "string"
        ? req.body.full_name.trim()
        : (user.profile?.full_name ?? "");
    const role =
      typeof req.body?.role === "string" ? req.body.role : user.profile?.role;
    const organizationName =
      typeof req.body?.organization_name === "string"
        ? req.body.organization_name.trim()
        : "";

    if (!isUserRole(role)) {
      throw new HttpError(400, "Role must be patient or insurance_provider");
    }
    if (!fullName) {
      throw new HttpError(400, "Full name is required");
    }

    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) {
      throw new HttpError(409, "Profile already exists");
    }

    let organizationId: string | null = null;
    if (role === "insurance_provider") {
      const orgName = organizationName || "Demo Insurance";
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName, type: "insurance_provider" })
        .select("id")
        .single();
      if (orgError || !org) {
        throw new HttpError(
          500,
          "Failed to create organization",
          orgError?.message,
        );
      }
      organizationId = org.id;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role,
        organization_id: organizationId,
      })
      .select("id, email, full_name, role, organization_id, created_at")
      .single();

    if (error || !profile) {
      throw new HttpError(500, "Failed to create profile", error?.message);
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    next(err);
  }
});

export default router;
