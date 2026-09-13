import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getAppeal,
  createNewAppeal,
  updateAppeal,
} from '../controllers/appeals.controller.js';
import {
  createAppealSchema,
  updateAppealSchema,
} from '../validators/appeals.validator.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/cases/:id/appeal
 * Get the current appeal for a case.
 */
router.get('/', getAppeal);

/**
 * POST /api/cases/:id/appeal
 * Create an appeal for a case. Insurance providers only.
 * Body: { appeal_text?, citations? }
 */
router.post('/', validate(createAppealSchema), createNewAppeal);

/**
 * PATCH /api/cases/:id/appeal/:appealId
 * Update appeal status: PENDING_REVIEW → APPROVED → SUBMITTED or REJECTED.
 * Insurance providers only.
 * Body: { status, appeal_text?, citations? }
 */
router.patch('/:appealId', validate(updateAppealSchema), updateAppeal);

export default router;
