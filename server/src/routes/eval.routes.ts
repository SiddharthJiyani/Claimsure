import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getEval, getHealth } from '../controllers/eval.controller.js';

const router: Router = Router();

/**
 * GET /api/eval/results
 * Get 20-case evaluation harness results from ai-server.
 * Insurance providers only.
 * Headers: Authorization: Bearer <token>
 */
router.get('/results', requireAuth, getEval);

/**
 * GET /api/eval/health
 * Health check — verifies Express + ai-server connectivity.
 * Public (no auth required).
 */
router.get('/health', getHealth);

export default router;
