import { Router } from "express";
import {
  handleSlackInteraction,
  sendSlackTest,
  webhookHealth,
} from "../controllers/webhooks.controller.js";

const router: Router = Router();

/**
 * POST /api/webhooks/slack
 * Receives Slack interactive component payloads (button clicks).
 * Slack signature verification should be enabled in production.
 * Content-Type: application/x-www-form-urlencoded
 * Body: { payload: "<json string>" }
 */
router.post("/slack", handleSlackInteraction);
router.post("/slack/test", sendSlackTest);

/**
 * GET /api/webhooks/health
 * Confirms the webhook endpoint is reachable.
 */
router.get("/health", webhookHealth);

export default router;
