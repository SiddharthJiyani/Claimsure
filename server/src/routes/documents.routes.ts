import multer from 'multer';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listDocuments,
  uploadDocument,
  updateDocumentMissing,
} from '../controllers/documents.controller.js';
import { uploadDocumentAndAnalyze } from '../controllers/upload.controller.js';
import {
  createDocumentSchema,
  markMissingSchema,
} from "../validators/documents.validator.js";

// Multer in-memory storage — only used for the /upload route.
// 50 MB max file size; mimetype filtering is intentionally permissive (PDF, images, text).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, TXT, PNG, JPEG, DOCX.`));
    }
  },
});

const router: Router = Router({ mergeParams: true });

// All document routes require authentication
router.use(requireAuth);

/**
 * GET /api/cases/:id/documents
 * List all documents for a case with missing/found split.
 * Access: patient (own cases), insurance_provider (org cases)
 */
router.get("/", listDocuments);

/**
 * POST /api/cases/:id/documents/upload
 * Full file-bytes upload endpoint. Accepts multipart/form-data.
 *
 * Form fields:
 *   - file             (required) — binary file (PDF, TXT, PNG, JPEG, DOCX)
 *   - document_type    (optional, default: "denial_letter")
 *   - display_name     (optional) — override stored document name
 *   - payer_id         (optional) — RAG context for AI agent
 *   - service_code     (optional) — RAG context for AI agent
 *   - patient_name     (optional) — passed to AI denial parser
 *   - skip_ai          (optional, "true"/"false") — upload to Drive only, skip AI
 *
 * Flow: upload → Drive → Supabase → AI agent → Sheets + Calendar + notifications
 */
router.post('/upload', upload.single('file'), uploadDocumentAndAnalyze);

/**
 * POST /api/cases/:id/documents
 * Register a document's metadata (file already uploaded to Drive separately).
 * Body: { name, document_type, drive_file_id, drive_url?, is_missing? }
 * Note: Use /upload if you want the server to handle file bytes directly.
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
