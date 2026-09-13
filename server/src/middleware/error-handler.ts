/**
 * Centralized error handler middleware.
 * Must be the LAST middleware registered in Express.
 * Maps AppError subclasses → structured HTTP responses.
 * Unexpected errors → 500 (without leaking internals in production).
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ─── Zod Validation Errors ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: (err.issues ?? (err as unknown as { errors: typeof err.issues }).errors ?? []).map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // ─── Operational AppErrors ─────────────────────────────────────────────────
  if (isAppError(err)) {
    // Log 500s as errors, everything else as warnings
    if (err.statusCode >= 500) {
      logger.error(`[${req.method}] ${req.path}`, err, { statusCode: err.statusCode });
    } else {
      logger.warn(`[${req.method}] ${req.path}: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // ─── Unexpected Errors ─────────────────────────────────────────────────────
  logger.error(`Unhandled error on [${req.method}] ${req.path}`, err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An internal server error occurred'
          : (err instanceof Error ? err.message : String(err)),
    },
  });
}
