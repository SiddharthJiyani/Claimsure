/**
 * Application error hierarchy.
 * Throw these from controllers/services; the centralized error handler
 * maps them to the correct HTTP status and response shape.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── 400 Bad Request ──────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

// ─── 401 Unauthorized ─────────────────────────────────────────────────────────
export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

// ─── 403 Forbidden ────────────────────────────────────────────────────────────
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

// ─── 404 Not Found ────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

// ─── 409 Conflict ─────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

// ─── 422 Unprocessable ────────────────────────────────────────────────────────
export class UnprocessableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "UNPROCESSABLE", details);
    this.name = "UnprocessableError";
  }
}

// ─── 429 Too Many Requests ────────────────────────────────────────────────────
export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
  }
}

// ─── 503 Service Unavailable ──────────────────────────────────────────────────
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableError";
  }
}

// ─── Type Guard ───────────────────────────────────────────────────────────────
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
