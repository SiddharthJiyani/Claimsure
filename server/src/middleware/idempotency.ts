/**
 * Idempotency middleware — prevents duplicate processing of write operations.
 *
 * Clients must send an `Idempotency-Key` header on POST/PATCH requests
 * that trigger external side effects (agent processing, email, Slack, etc.).
 *
 * Format: <case_id>:<action_type>   e.g. "abc-123:process_agent"
 *
 * If a cached response exists for the key, it is returned immediately.
 * Otherwise, the request is processed and the response is cached.
 */

import type { Request, Response, NextFunction } from "express";
import { supabase } from "../database/supabase.js";
import { logger } from "../lib/logger.js";

const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * requireIdempotency — enforces the presence of the idempotency key header.
 * Use on routes where duplicate execution would cause side effects.
 */
export function requireIdempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.headers[IDEMPOTENCY_HEADER];

  if (!key || typeof key !== "string" || key.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_IDEMPOTENCY_KEY",
        message: `The '${IDEMPOTENCY_HEADER}' header is required for this request`,
      },
    });
    return;
  }

  req.idempotencyKey = key.trim();
  next();
}

/**
 * checkIdempotency — checks if a cached response exists for the key.
 * If yes, returns the cached response. If no, continues and caches on response.
 */
export async function checkIdempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.idempotencyKey;
  if (!key) {
    next();
    return;
  }

  try {
    const { data } = await supabase
      .from("idempotency_keys")
      .select("response, created_at")
      .eq("key", key)
      .maybeSingle();

    if (data) {
      // Check TTL
      const created = new Date(data.created_at as string).getTime();
      const expiry = created + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;

      if (Date.now() < expiry) {
        logger.debug("Idempotency cache hit", { key });
        res.setHeader("X-Idempotency-Replayed", "true");
        res.status(200).json(data.response);
        return;
      }
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        supabase
          .from("idempotency_keys")
          .upsert({ key, response: body }, { onConflict: "key" })
          .then(({ error }) => {
            if (error)
              logger.warn("Failed to cache idempotency response", {
                key,
                error: error.message,
              });
          });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    // Don't fail the request if idempotency check fails — just proceed
    logger.warn("Idempotency check failed, proceeding without cache", {
      key,
      err,
    });
    next();
  }
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}
