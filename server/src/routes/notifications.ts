import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const { data, error } = await getServiceClient()
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error)
      throw new HttpError(500, "Failed to load notifications", error.message);
    res.json({ notifications: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const { data, error } = await getServiceClient()
      .from("notifications")
      .update({ is_read: true })
      .eq("id", req.params.id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
    if (error)
      throw new HttpError(500, "Failed to update notification", error.message);
    if (!data) throw new HttpError(404, "Notification not found");
    res.json({ notification: data });
  } catch (err) {
    next(err);
  }
});

export default router;
