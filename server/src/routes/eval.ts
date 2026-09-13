import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("insurance_provider"),
  async (_req, res, next) => {
    try {
      const aiUrl = process.env.AI_SERVER_URL;
      if (aiUrl) {
        try {
          const response = await fetch(`${aiUrl}/eval/results`);
          if (response.ok) {
            res.json(await response.json());
            return;
          }
        } catch {
          // AI server is optional until the harness exists.
        }
      }
      res.json({ metrics: [], cases: 0 });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
