/**
 * Documents controller — upload metadata, list, and mark missing.
 * Actual files live in Google Drive; only metadata is stored in Supabase.
 */

import type { Request, Response, NextFunction } from 'express';
import { getCaseById } from '../database/queries/cases.js';
import {
  getDocumentsByCase,
  getDocumentById,
  createDocument,
  markDocumentMissing,
  getMissingDocumentsByCase,
} from '../database/queries/documents.js';
import { createAuditLog } from '../database/queries/audit.js';
import { notifyPatient, notifyInsurersByOrg } from '../services/notifications.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import { ForbiddenError } from '../lib/errors.js';
import type { CreateDocumentInput, MarkMissingInput } from '../validators/documents.validator.js';

// ─── List Documents for a Case ────────────────────────────────────────────────

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;

    const caseData = await getCaseById(caseId);

    // Access control
    if (user.role === 'patient' && caseData.patient_id !== user.id) {
      throw new ForbiddenError('You do not have access to documents for this case');
    }
    if (user.role === 'insurance_provider' && caseData.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError('You do not have access to documents for this case');
    }

    const documents = await getDocumentsByCase(caseId);
    const missing = documents.filter((d) => d.is_missing);
    const found = documents.filter((d) => !d.is_missing);

    sendSuccess(res, { documents, missing_count: missing.length, found_count: found.length });
  } catch (err) {
    next(err);
  }
}

// ─── Upload Document Metadata ─────────────────────────────────────────────────

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;
    const body = req.body as CreateDocumentInput;

    const caseData = await getCaseById(caseId);

    // Patients can upload to their own cases; insurers to their org's cases
    if (user.role === 'patient' && caseData.patient_id !== user.id) {
      throw new ForbiddenError();
    }
    if (user.role === 'insurance_provider' && caseData.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError();
    }

    const document = await createDocument({
      case_id: caseId,
      name: body.name,
      document_type: body.document_type,
      drive_file_id: body.drive_file_id,
      ...(body.drive_url !== undefined ? { drive_url: body.drive_url } : {}),
      uploaded_by: user.id,
      is_missing: body.is_missing,
    });

    await createAuditLog({
      case_id: caseId,
      actor_id: user.id,
      actor_type: 'human',
      action: 'document_uploaded',
      metadata: {
        document_name: body.name,
        document_type: body.document_type,
        drive_file_id: body.drive_file_id,
      },
    });

    // If patient uploaded a previously-missing doc, notify insurer
    if (user.role === 'patient' && !body.is_missing) {
      notifyInsurersByOrg(
        caseData.insurer_org_id,
        caseId,
        'case_update',
        'Document Uploaded',
        `Patient uploaded: ${body.name} for case ${caseData.case_number}`,
        { caseNumber: caseData.case_number },
      ).catch(() => {});
    }

    sendCreated(res, document, 'Document metadata saved');
  } catch (err) {
    next(err);
  }
}

// ─── Mark Document Missing/Found ──────────────────────────────────────────────

export async function updateDocumentMissing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;
    const docId = req.params.docId as string;
    const body = req.body as MarkMissingInput;

    if (user.role !== 'insurance_provider') {
      throw new ForbiddenError('Only insurance providers can flag documents');
    }

    const caseData = await getCaseById(caseId);
    if (caseData.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError();
    }

    const updated = await markDocumentMissing(docId, body.is_missing);

    // If flagging as missing, notify patient
    if (body.is_missing) {
      const missingDocs = await getMissingDocumentsByCase(caseId);
      notifyPatient(
        caseData.patient_id,
        caseId,
        'action_required',
        'Action Required: Missing Documents',
        `Additional documents are required for case ${caseData.case_number}.`,
        {
          caseNumber: caseData.case_number,
          missingDocs: missingDocs.map((d) => d.name),
        },
      ).catch(() => {});
    }

    sendSuccess(res, updated, `Document marked as ${body.is_missing ? 'missing' : 'found'}`);
  } catch (err) {
    next(err);
  }
}
