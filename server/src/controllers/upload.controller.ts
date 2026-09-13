/**
 * Upload controller — the single endpoint that wires the full Claimsure product flow:
 *
 *   multipart file upload
 *     → Google Drive (upload bytes)
 *     → Supabase documents + denials (store metadata)
 *     → Python AI server (extract text → RAG → 9-node agent)
 *     → Google Sheets (mirror updated case status)
 *     → Google Calendar (create appeal deadline if agent returns one)
 *     → Notifications (patient + insurer)
 *     ← Return combined result
 */

import type { Request, Response, NextFunction } from 'express';
import { basename } from 'node:path';

import { getCaseById, updateCaseStatus } from '../database/queries/cases.js';
import { createDocument } from '../database/queries/documents.js';
import { createDenialForCase, getDenialsByCase, updateDenialDriveFile } from '../database/queries/denials.js';
import { createAuditLog } from '../database/queries/audit.js';
import { uploadFile } from '../services/google-drive.js';
import * as aiClient from '../services/ai-client.js';
import * as sheetsService from '../services/google-sheets.js';
import { createAppealDeadlineEvent } from '../services/google-calendar.js';
import { notifyPatient, notifyInsurersByOrg } from '../services/notifications.js';
import { sendCreated } from '../lib/response.js';
import { ForbiddenError, ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { uploadDocumentFieldsSchema } from '../validators/upload.validator.js';
import type { CaseStatus } from '../types/index.js';

// ─── MIME helper ──────────────────────────────────────────────────────────────

function mimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

// ─── Resolve final case status from agent result ──────────────────────────────

function resolveStatus(result: aiClient.ProcessCaseResult): CaseStatus {
  if (result.final_node === 'resolved') return 'RESOLVED';
  if (result.final_node === 'escalated') return 'ESCALATED';
  if (result.route_decision === 'human_review') return 'AWAITING_REVIEW';
  if (result.route_decision === 'automatable') return 'APPEAL_READY';
  return 'ACTION_REQUIRED';
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/cases/:id/documents/upload
 *
 * Accepts multipart/form-data with:
 *   - `file`           (required) — the binary file
 *   - `document_type`  (optional, default: "denial_letter")
 *   - `display_name`   (optional) — override the stored document name
 *   - `payer_id`       (optional) — passed to AI for RAG context
 *   - `service_code`   (optional) — passed to AI for RAG context
 *   - `patient_name`   (optional) — passed to AI for denial parsing
 *   - `skip_ai`        (optional, "true"/"false") — skip AI analysis step
 */
export async function uploadDocumentAndAnalyze(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;

    // ── 0. File presence check ──────────────────────────────────────────────
    const multerFile = (req as Request & { file?: Express.Multer.File }).file;
    if (!multerFile) {
      throw new ValidationError('No file uploaded. Send a multipart/form-data request with a "file" field.');
    }

    // ── 0b. Parse + validate form fields ──────────────────────────────────
    const fields = uploadDocumentFieldsSchema.safeParse(req.body);
    if (!fields.success) {
      throw new ValidationError('Invalid upload fields', fields.error.issues);
    }
    const { document_type, display_name, payer_id, service_code, patient_name, skip_ai } = fields.data;

    // ── 0c. Access control ────────────────────────────────────────────────
    const caseData = await getCaseById(caseId);
    if (user.role === 'patient' && caseData.patient_id !== user.id) {
      throw new ForbiddenError();
    }
    if (user.role === 'insurance_provider' && caseData.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError();
    }

    const originalName = multerFile.originalname || 'document';
    const storedName = display_name ?? basename(originalName);
    const mimeType = multerFile.mimetype || mimeTypeFromFilename(originalName);
    const fileBuffer = multerFile.buffer;

    // ── 1. Upload bytes to Google Drive ───────────────────────────────────
    logger.info('Uploading file to Drive', { caseId, filename: storedName, size: fileBuffer.length });
    const driveFile = await uploadFile({
      name: `${caseData.case_number}-${storedName}`,
      mimeType,
      content: fileBuffer,
    });
    logger.info('Drive upload complete', { driveFileId: driveFile.id });

    // ── 2. Store document metadata in Supabase ────────────────────────────
    const document = await createDocument({
      case_id: caseId,
      name: storedName,
      document_type,
      drive_file_id: driveFile.id,
      ...(driveFile.webViewLink !== null ? { drive_url: driveFile.webViewLink } : {}),
      uploaded_by: user.id,
      is_missing: false,
    });

    await createAuditLog({
      case_id: caseId,
      actor_id: user.id,
      actor_type: 'human',
      action: 'document_uploaded_to_drive',
      metadata: {
        document_name: storedName,
        document_type,
        drive_file_id: driveFile.id,
        drive_url: driveFile.webViewLink,
        file_size_bytes: fileBuffer.length,
      },
    });

    // ── 3. If denial letter, link Drive file to the denials table ─────────
    let denialId: string | undefined;
    if (document_type === 'denial_letter') {
      const existingDenials = await getDenialsByCase(caseId);
      if (existingDenials.length > 0 && existingDenials[0]) {
        // Update the most recent denial with the Drive file ID
        const updated = await updateDenialDriveFile(existingDenials[0].id, driveFile.id);
        denialId = updated.id;
        logger.info('Denial updated with Drive file ID', { denialId, driveFileId: driveFile.id });
      } else {
        // No denial record yet — create one with a placeholder reason (AI will parse it properly)
        const newDenial = await createDenialForCase({
          case_id: caseId,
          denial_reason: 'Pending AI extraction',
          drive_file_id: driveFile.id,
        });
        denialId = newDenial.id;
        logger.info('Denial record created with Drive file ID', { denialId, driveFileId: driveFile.id });
      }
    }

    // ── 4. Skip AI path: return early if requested ────────────────────────
    if (skip_ai) {
      logger.info('skip_ai=true, returning after Drive upload', { caseId });
      sendCreated(res, {
        document,
        drive_file_id: driveFile.id,
        drive_url: driveFile.webViewLink,
        agent_result: null,
        message: 'File uploaded to Drive and metadata stored. AI analysis skipped.',
      }, 'Document uploaded');
      return;
    }

    // ── 5. Call Python AI server — upload bytes + run 9-node agent ────────
    logger.info('Sending file to AI server for analysis', { caseId, filename: storedName });
    const agentResult = await aiClient.uploadAndAnalyze(fileBuffer, originalName, {
      caseId,
      caseNumber: caseData.case_number,
      // Only pass defined values to satisfy exactOptionalPropertyTypes
      ...(patient_name !== undefined ? { patientName: patient_name } : {}),
      ...(payer_id !== undefined ? { payerId: payer_id } : caseData.payer_id !== null ? { payerId: caseData.payer_id } : {}),
      ...(service_code !== undefined ? { serviceCode: service_code } : caseData.service_code !== null ? { serviceCode: caseData.service_code } : {}),
    });
    logger.info('AI analysis complete', {
      caseId,
      status: agentResult.status,
      route: agentResult.route_decision,
      confidence: agentResult.confidence,
    });

    // ── 6. Update case status based on agent result ───────────────────────
    const finalStatus = resolveStatus(agentResult);
    await updateCaseStatus(caseId, finalStatus).catch((err: unknown) => {
      logger.warn('Failed to update case status after agent analysis', { caseId, err });
    });

    await createAuditLog({
      case_id: caseId,
      actor_type: 'agent',
      action: 'agent_upload_analysis_complete',
      previous_state: caseData.status,
      new_state: finalStatus,
      confidence: agentResult.confidence,
      citations: agentResult.citations ?? [],
      metadata: {
        final_node: agentResult.final_node,
        route_decision: agentResult.route_decision,
        evidence_found: agentResult.evidence_found,
        evidence_missing: agentResult.evidence_missing,
        drive_file_id: driveFile.id,
      },
    });

    // ── 7. Mirror status update to Google Sheets (non-blocking) ──────────
    sheetsService.updateCaseRow({
      ...caseData,
      status: finalStatus,
      updated_at: new Date().toISOString(),
    }).catch((err: unknown) => {
      logger.warn('Sheets update failed (non-fatal)', { caseId, err });
    });

    // ── 8. Create Calendar deadline if agent returned one ─────────────────
    let calendarEvent: Awaited<ReturnType<typeof createAppealDeadlineEvent>> | null = null;
    const appealDeadline = agentResult.audit_trail
      .map((entry) => {
        // Try to find a deadline date in audit metadata (Python agent writes it here)
        const match = entry.action.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        return match ? match[1] : null;
      })
      .find(Boolean);

    if (appealDeadline) {
      calendarEvent = await createAppealDeadlineEvent({
        summary: `Appeal Deadline: ${caseData.case_number}`,
        description: [
          `Case: ${caseData.case_number}`,
          `Service: ${caseData.service_type}`,
          `Agent route: ${agentResult.route_decision}`,
          `Drive file: ${driveFile.webViewLink ?? driveFile.id}`,
        ].join('\n'),
        startDate: appealDeadline,
      }).catch((err: unknown) => {
        logger.warn('Calendar event creation failed (non-fatal)', { caseId, err });
        return null;
      });
    }

    // ── 9. Notify patient + insurer (non-blocking) ────────────────────────
    const notifyType =
      agentResult.route_decision === 'human_review' ? 'approval_request' :
      agentResult.final_node === 'escalated' ? 'escalation' : 'case_update';

    notifyInsurersByOrg(
      caseData.insurer_org_id,
      caseId,
      notifyType,
      'AI Analysis Complete',
      `Agent completed analysis for case ${caseData.case_number}. ` +
      `Decision: ${agentResult.route_decision}. ` +
      (agentResult.evidence_missing.length > 0
        ? `Missing: ${agentResult.evidence_missing.join(', ')}`
        : 'No missing evidence detected.'),
      {
        caseNumber: caseData.case_number,
        agentSummary: agentResult.appeal_text ?? '',
        confidence: agentResult.confidence,
      },
    ).catch(() => {});

    notifyPatient(
      caseData.patient_id,
      caseId,
      'case_update',
      'Document Received & Analyzed',
      `Your document for case ${caseData.case_number} has been uploaded and analyzed. ` +
      (agentResult.evidence_missing.length > 0
        ? `Additional documents may be needed.`
        : `No additional action is required from you at this time.`),
      { caseNumber: caseData.case_number },
    ).catch(() => {});

    // ── 10. Respond ───────────────────────────────────────────────────────
    sendCreated(res, {
      document,
      drive_file_id: driveFile.id,
      drive_url: driveFile.webViewLink,
      denial_id: denialId ?? null,
      agent_result: {
        status: agentResult.status,
        final_node: agentResult.final_node,
        route_decision: agentResult.route_decision,
        confidence: agentResult.confidence,
        evidence_found: agentResult.evidence_found,
        evidence_missing: agentResult.evidence_missing,
        appeal_text: agentResult.appeal_text ?? null,
        citations: agentResult.citations ?? ([] as import('../types/index.js').PolicyCitation[]),
        actions_taken: agentResult.actions_taken,
        audit_trail: agentResult.audit_trail,
      },
      case_status: finalStatus,
      calendar_event: calendarEvent,
    }, 'File uploaded, analyzed, and workflow complete');
  } catch (err) {
    next(err);
  }
}
