import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  requireIdempotency,
  checkIdempotency,
} from "../middleware/idempotency.js";
import {
  getCases,
  getCaseDetail,
  createNewCase,
  patchCaseStatus,
  processCase,
  getCaseAudit,
} from "../controllers/cases.controller.js";
import {
  makeClaimDecision,
  getClaimDecision,
  makeAppealDecision,
  claimDecisionSchema,
} from "../controllers/decisions.controller.js";
import {
  createCaseSchema,
  updateCaseStatusSchema,
  listCasesQuerySchema,
  processCaseSchema,
} from "../validators/cases.validator.js";

const router: Router = Router();

// All case routes require authentication
router.use(requireAuth);

/**
 * GET /api/cases
 * List cases scoped to the authenticated user's role.
 * - Patient: sees only their own cases
 * - Insurance Provider: sees all cases for their org
 * Query: ?status=PENDING&page=1&limit=20
 */
router.get("/", validateQuery(listCasesQuerySchema), getCases);

/**
 * GET /api/cases/:id
 * Get full case detail including denials, documents, appeals, and audit trail.
 */
router.get("/:id", getCaseDetail);

/**
 * POST /api/cases
 * Create a new case. Insurance providers only.
 * Body: { patient_id, insurer_org_id, service_type, service_code?, payer_id?, denial_reason?, denial_code?, denial_date?, appeal_deadline? }
 * Headers: Authorization: Bearer <token>
 */
router.post("/", validate(createCaseSchema), createNewCase);

/**
 * PATCH /api/cases/:id
 * Update case status. Insurance providers only.
 * Body: { status }
 */
router.patch("/:id", validate(updateCaseStatusSchema), patchCaseStatus);

/**
 * POST /api/cases/:id/process
 * Trigger the 9-node AI agent on this case. Insurance providers only.
 * Headers: Idempotency-Key: <case_id>:process_agent
 * Body: { dry_run?: boolean }
 */
router.post(
  "/:id/process",
  requireIdempotency,
  checkIdempotency,
  validate(processCaseSchema),
  processCase,
);

router.post(
  "/:id/analyze",
  requireIdempotency,
  checkIdempotency,
  validate(processCaseSchema),
  processCase,
);


/**
 * GET /api/cases/:id/audit
 * Get append-only audit trail for a case.
 * Both patients (own cases) and insurers (org cases) can view.
 */
router.get("/:id/audit", getCaseAudit);

/**
 * POST /api/cases/:id/decision
 * Insurance provider accepts or rejects a claim with a reason.
 * Triggers email notification to patient.
 * Body: { decision: "ACCEPTED" | "REJECTED", reason: string }
 */
router.post("/:id/decision", validate(claimDecisionSchema), makeClaimDecision);

/**
 * GET /api/cases/:id/decision
 * Retrieve the latest insurer decision for a case (both roles can view).
 */
router.get("/:id/decision", getClaimDecision);

/**
 * POST /api/cases/:id/appeal-decision
 * Insurance provider accepts or rejects a PATIENT APPEAL.
 * Body: { decision: "ACCEPTED" | "REJECTED", reason: string }
 */
router.post("/:id/appeal-decision", validate(claimDecisionSchema), makeAppealDecision);

export default router;
