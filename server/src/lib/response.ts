/**
 * Standard API response helpers.
 * All API responses must go through these helpers for consistency.
 */

import type { Response } from "express";

// ─── Response Envelope ────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Send a successful JSON response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
<<<<<<< HEAD
  optionsOrMessage?: string | { message?: string; statusCode?: number; meta?: Record<string, unknown> },
=======
  options?: {
    message?: string;
    statusCode?: number;
    meta?: Record<string, unknown>;
  },
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
): void {
  const options = typeof optionsOrMessage === 'string' ? { message: optionsOrMessage } : optionsOrMessage;
  const { message, statusCode = 200, meta } = options ?? {};
  const body: ApiSuccess<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  };
  res.status(statusCode).json(body);
}

/**
 * Send a created (201) response.
 */
export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, { statusCode: 201, ...(message !== undefined ? { message } : {}) });
}

/**
 * Send an empty 204 No Content response.
 */
export function sendNoContent(res: Response): void {
  res.status(204).end();
}

/**
 * Send a paginated list response.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  sendSuccess(res, data, {
    meta: {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    },
  });
}
