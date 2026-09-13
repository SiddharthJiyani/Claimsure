/**
 * Zod request validation middleware factory.
 * Usage: validate(myZodSchema) — validates req.body against the schema.
 *        validateQuery(myZodSchema) — validates req.query.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * validate — validates req.body against a Zod schema.
 * Attaches parsed data back to req.body (type-safe, coerced).
 */
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as unknown;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(err);
      } else {
        next(err);
      }
    }
  };
}

/**
 * validateQuery — validates req.query against a Zod schema.
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      (req as Request & { parsedQuery: T }).parsedQuery = schema.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * validateParams — validates req.params against a Zod schema.
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      (req as Request & { parsedParams: T }).parsedParams = schema.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Extend Express Request with parsed types
declare global {
  namespace Express {
    interface Request {
      parsedQuery?: unknown;
      parsedParams?: unknown;
    }
  }
}
