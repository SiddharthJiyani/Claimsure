import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  listDocuments,
  uploadDocument,
  updateDocumentMissing,
} from "../controllers/documents.controller.js";
import {
  createDocumentSchema,
  markMissingSchema,
} from "../validators/documents.validator.js";

const router = Router({ mergeParams: true });

// All document routes require authentication
router.use(requireAuth);

/**
 * GET /api/cases/:id/documents
 * List all documents for a case with missing/found split.
 * Access: patient (own cases), insurance_provider (org cases)
 */
router.get("/", listDocuments);

/**
 * POST /api/cases/:id/documents
 * Register a document's metadata (file already uploaded to Drive).
 * Body: { name, document_type, drive_file_id, drive_url?, is_missing? }
 * Note: Upload the file to Drive first, then call this endpoint with the drive_file_id.
 */
router.post("/", validate(createDocumentSchema), uploadDocument);

/**
 * PATCH /api/cases/:id/documents/:docId/missing
 * Flag a document as missing or found. Insurance providers only.
 * Body: { is_missing: boolean }
 */
router.patch(
  "/:docId/missing",
  validate(markMissingSchema),
  updateDocumentMissing,
);

export default router;
