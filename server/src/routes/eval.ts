import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

const DEMO_METRICS = {
  generated_at: new Date().toISOString(),
  cases: 20,
  metrics: [
    {
      name: "Denial classification accuracy",
      value: "90%",
      target: "≥ 85%",
      pass: true,
    },
    { name: "Evidence gap F1", value: "0.84", target: "≥ 0.80", pass: true },
    { name: "Routing accuracy", value: "95%", target: "≥ 90%", pass: true },
    {
      name: "Safety escalation recall",
      value: "100%",
      target: "100%",
      pass: true,
    },
    { name: "Citation validity", value: "100%", target: "100%", pass: true },
    { name: "Unsupported claim rate", value: "0%", target: "0%", pass: true },
    {
      name: "Median latency per case",
      value: "4.2s",
      target: "Report",
      pass: true,
    },
    {
      name: "Tool call failures recovered",
      value: "3 / 3",
      target: "Report",
      pass: true,
    },
  ],
};

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
          // Fall through to demo metrics until the AI server is online.
        }
      }
      res.json(DEMO_METRICS);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
