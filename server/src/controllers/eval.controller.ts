/**
 * Eval controller — proxies to the ai-server evaluation harness.
 * Insurance providers only (patients don't need eval metrics).
 */

import type { Request, Response, NextFunction } from "express";
import { getEvalResults } from "../services/ai-client.js";
import { healthCheck } from "../services/ai-client.js";
import { sendSuccess } from "../lib/response.js";
import { ForbiddenError } from "../lib/errors.js";

// ─── Get Evaluation Results ───────────────────────────────────────────────────

export async function getEval(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;

    if (user.role !== "insurance_provider") {
      throw new ForbiddenError(
        "Evaluation results are only available to insurance providers",
      );
    }

    const results = await getEvalResults();
    sendSuccess(res, results, "Evaluation results retrieved");
  } catch (err) {
    next(err);
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function getHealth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const aiStatus = await healthCheck();

    sendSuccess(res, {
      server: "ok",
      ai_server: aiStatus.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
