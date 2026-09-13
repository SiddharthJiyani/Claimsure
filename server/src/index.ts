<<<<<<< HEAD
import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
=======
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { isSupabaseConfigured } from "./database/supabase.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRouter from "./routes/auth.js";
import casesRouter from "./routes/cases.js";
import documentsRouter from "./routes/documents.js";
import appealsRouter from "./routes/appeals.js";
import notificationsRouter from "./routes/notifications.js";
import evalRouter from "./routes/eval.js";
import demoRouter from "./routes/demo.js";

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import apiRoutes from "./routes/index.js";

// ─── App Init ─────────────────────────────────────────────────────────────────

const app: Express = express();

// ─── Security Middleware ──────────────────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  }),
);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests — please try again later",
      },
    },
  }),
);

// ─── Logging ──────────────────────────────────────────────────────────────────

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Body Parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));
// Needed for Slack webhook payload (URL-encoded form)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Health Check (no auth) ───────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "claimsure-server",
      version: "1.0.0",
      environment: env.NODE_ENV,
      dry_run: env.DRY_RUN,
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use("/api", apiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist",
    },
  });
});

// ─── Centralized Error Handler (must be last) ─────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Claimsure server running`, {
    port: env.PORT,
    env: env.NODE_ENV,
    dry_run: env.DRY_RUN,
  });
  logger.info(`📋 Health: http://localhost:${env.PORT}/health`);
  logger.info(`🔌 API:    http://localhost:${env.PORT}/api`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string) {
  logger.info(`Received ${signal}. Graceful shutdown...`);
  server.close(() => {
    logger.info("Server closed. Exiting.");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", err);
  process.exit(1);
});

export default app;
