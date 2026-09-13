/**
 * Cases controller — CRUD + agent trigger.
 * Role-scoped: patients see own cases, insurers see org cases.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  listCases,
  getCaseById,
  getCaseWithDetails,
  createCase,
  updateCaseStatus,
} from '../database/queries/cases.js';
import { createAuditLog } from '../database/queries/audit.js';
import { createDenialForCase } from '../database/queries/denials.js';
import * as aiClient from '../services/ai-client.js';
import * as sheetsService from '../services/google-sheets.js';
import { notifyPatient, notifyInsurersByOrg } from '../services/notifications.js';
import { sendSuccess, sendCreated, sendPaginated } from '../lib/response.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { CreateCaseInput, ListCasesQuery, UpdateCaseStatusInput, ProcessCaseInput } from '../validators/cases.validator.js';

// ─── List Cases ───────────────────────────────────────────────────────────────

export async function getCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const query = req.parsedQuery as ListCasesQuery;

    // Build org-scoped filter based on role
    const filter =
      user.role === 'patient'
        ? { patient_id: user.id, ...(query.status !== undefined ? { status: query.status } : {}) }
        : { ...(user.organization_id !== undefined ? { insurer_org_id: user.organization_id } : {}), ...(query.status !== undefined ? { status: query.status } : {}) } as any;

    const result = await listCases(filter, { page: query.page, limit: query.limit });

    sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    next(err);
  }
}

// ─── Get Case Detail ──────────────────────────────────────────────────────────

export async function getCaseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const caseWithDetails = await getCaseWithDetails(id);
    const caseData = caseWithDetails as { patient_id: string; insurer_org_id: string };

    // Access control: patients only see their own cases
    if (user.role === 'patient' && caseData.patient_id !== user.id) {
      throw new ForbiddenError('You do not have access to this case');
    }

    // Access control: insurers only see their org's cases
    if (user.role === 'insurance_provider' && caseData.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError('You do not have access to this case');
    }

    sendSuccess(res, caseWithDetails);
  } catch (err) {
    next(err);
  }
}

// ─── Create Case ──────────────────────────────────────────────────────────────

export async function createNewCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const body = req.body as CreateCaseInput;

    // Only insurance_provider can create cases
    // (Checked at route level via requireRole, but double-check here)
    if (user.role !== 'insurance_provider') {
      throw new ForbiddenError('Only insurance providers can create cases');
    }

    const newCase = await createCase({
      case_number: `R${Date.now().toString().slice(-6)}`,
      patient_id: body.patient_id,
      insurer_org_id: body.insurer_org_id,
      service_type: body.service_type,
      ...(body.service_code !== undefined ? { service_code: body.service_code } : {}),
      ...(body.payer_id !== undefined ? { payer_id: body.payer_id } : {}),
    });

    // Optionally create denial record if denial info provided
    if (body.denial_reason) {
      await createDenialForCase({
        case_id: newCase.id,
        denial_reason: body.denial_reason,
        ...(body.denial_code !== undefined ? { denial_code: body.denial_code } : {}),
        ...(body.denial_date !== undefined ? { denial_date: body.denial_date } : {}),
        ...(body.appeal_deadline !== undefined ? { appeal_deadline: body.appeal_deadline } : {}),
      });
    }

    // Audit log
    await createAuditLog({
      case_id: newCase.id,
      actor_id: user.id,
      actor_type: 'human',
      action: 'case_created',
      new_state: 'PENDING',
      metadata: { created_by: user.email },
    });

    // Mirror to Sheets (non-blocking)
    sheetsService.appendCaseRow(newCase).catch(() => {});

    // Notify patient
    notifyPatient(body.patient_id, newCase.id, 'case_update', 'Case Created',
      `Your case ${newCase.case_number} has been created and is pending review.`,
      { caseNumber: newCase.case_number }).catch(() => {});

    sendCreated(res, newCase, 'Case created successfully');
  } catch (err) {
    next(err);
  }
}

// ─── Update Case Status ───────────────────────────────────────────────────────

export async function patchCaseStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const body = req.body as UpdateCaseStatusInput;

    if (user.role !== 'insurance_provider') {
      throw new ForbiddenError('Only insurance providers can update case status');
    }

    const existing = await getCaseById(id);

    if (existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError('You do not have access to this case');
    }

    const updated = await updateCaseStatus(id, body.status);

    await createAuditLog({
      case_id: id,
      actor_id: user.id,
      actor_type: 'human',
      action: 'status_updated',
      previous_state: existing.status,
      new_state: body.status,
      metadata: { updated_by: user.email },
    });

    // Update Sheets mirror
    sheetsService.updateCaseRow(updated).catch(() => {});

    sendSuccess(res, updated, 'Case status updated');
  } catch (err) {
    next(err);
  }
}

// ─── Trigger AI Agent ─────────────────────────────────────────────────────────

export async function processCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const body = req.body as ProcessCaseInput;

    if (user.role !== 'insurance_provider') {
      throw new ForbiddenError('Only insurance providers can trigger AI agent processing');
    }

    const existing = await getCaseById(id);

    if (existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError('You do not have access to this case');
    }

    // Update status to ANALYZING
    await updateCaseStatus(id, 'ANALYZING');

    await createAuditLog({
      case_id: id,
      actor_id: user.id,
      actor_type: 'human',
      action: 'agent_triggered',
      previous_state: existing.status,
      new_state: 'ANALYZING',
      metadata: { triggered_by: user.email, dry_run: body.dry_run || env.DRY_RUN },
    });

    // Call AI server (async — returns immediately with ANALYZING status)
    const isDryRun = body.dry_run || env.DRY_RUN;

    // Fire and forget the agent — the agent will update status via webhooks/API
    aiClient.processCase(id, isDryRun).then(async (result) => {
      // Update final status based on agent result
      const finalStatus = result.final_node === 'resolved' ? 'RESOLVED' :
                          result.final_node === 'escalated' ? 'ESCALATED' :
                          result.route_decision === 'human_review' ? 'AWAITING_REVIEW' :
                          'ACTION_REQUIRED';

      await updateCaseStatus(id, finalStatus).catch(() => {});

      // Notify insurer of result
      notifyInsurersByOrg(
        existing.insurer_org_id,
        id,
        result.route_decision === 'human_review' ? 'approval_request' :
        result.final_node === 'escalated' ? 'escalation' : 'case_update',
        'AI Analysis Complete',
        `Agent completed analysis for case ${existing.case_number}. Decision: ${result.route_decision}`,
        {
          caseNumber: existing.case_number,
          agentSummary: result.appeal_text ?? '',
          confidence: result.confidence,
          serviceType: existing.service_type,
        },
      ).catch(() => {});

      // Notify patient
      notifyPatient(existing.patient_id, id, 'case_update',
        'Your Case Is Being Processed',
        `We're reviewing case ${existing.case_number}. You'll be notified when action is required.`,
        { caseNumber: existing.case_number },
      ).catch(() => {});
    }).catch((err) => {
      // If AI server fails, revert status
      updateCaseStatus(id, 'ACTION_REQUIRED').catch(() => {});
      createAuditLog({
        case_id: id,
        actor_type: 'system',
        action: 'agent_failed',
        metadata: { error: err instanceof Error ? err.message : String(err) },
      }).catch(() => {});
    });

    sendSuccess(res, { case_id: id, status: 'ANALYZING' },
      `AI agent processing started${isDryRun ? ' (DRY_RUN mode)' : ''}`);
  } catch (err) {
    next(err);
  }
}

// ─── Get Audit Trail ──────────────────────────────────────────────────────────

export async function getCaseAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const existing = await getCaseById(id);

    // Access check
    if (user.role === 'patient' && existing.patient_id !== user.id) {
      throw new ForbiddenError();
    }
    if (user.role === 'insurance_provider' && existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError();
    }

    const { getAuditLogsByCase } = await import('../database/queries/audit.js');
    const logs = await getAuditLogsByCase(id);

    sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}
