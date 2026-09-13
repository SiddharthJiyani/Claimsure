/**
 * Structured logger using console with level filtering.
 * In production, replace with a proper transport (e.g., pino, winston).
 */

import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('debug')) console.debug(format('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('info')) console.info(format('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('warn')) console.warn(format('warn', message, meta));
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;
    const errMeta =
      error instanceof Error
        ? { ...meta, err: { message: error.message, stack: error.stack, name: error.name } }
        : { ...meta, err: error };
    console.error(format('error', message, errMeta));
  },
};
