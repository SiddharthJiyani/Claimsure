/**
 * Central route registry — mounts all sub-routers under /api.
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import casesRoutes from './cases.routes.js';
import documentsRoutes from './documents.routes.js';
import appealsRoutes from './appeals.routes.js';
import notificationsRoutes from './notifications.routes.js';
import evalRoutes from './eval.routes.js';
import webhooksRoutes from './webhooks.routes.js';

const router = Router();

// ─── Route Mounts ──────────────────────────────────────────────────────────────

router.use('/auth', authRoutes);
router.use('/cases', casesRoutes);

// Sub-routers for case-scoped resources (inherit :id from cases)
router.use('/cases/:id/documents', documentsRoutes);
router.use('/cases/:id/appeal', appealsRoutes);

router.use('/notifications', notificationsRoutes);
router.use('/eval', evalRoutes);
router.use('/webhooks', webhooksRoutes);

export default router;
