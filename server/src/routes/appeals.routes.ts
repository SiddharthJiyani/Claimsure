/**
 * Appeals routes — role-correct model:
 *
 *   GET  /api/cases/:id/appeal     → Both roles can view
 *   GET  /api/cases/:id/appeals    → List all appeals (both roles)
 *   POST /api/cases/:id/appeal     → Patient only: submit an appeal after rejection
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  getAppeal,
  submitPatientAppeal,
  getAppealsForCase,
  submitAppealSchema,
} from "../controllers/appeals.controller.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * GET /api/cases/:id/appeal
 * Get the latest appeal for a case. Both patients (own) and insurers (org) can view.
 */
router.get("/", getAppeal);

/**
 * GET /api/cases/:id/appeals
 * List all appeals for a case.
 */
router.get("/all", getAppealsForCase);

/**
 * POST /api/cases/:id/appeal
 * PATIENT ONLY: Submit an appeal when their claim was rejected.
 * Body: { appeal_text: string, citations?: [...] }
 */
router.post("/", validate(submitAppealSchema), submitPatientAppeal);

export default router;
