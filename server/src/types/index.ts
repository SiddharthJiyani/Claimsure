/**
 * Shared TypeScript types and enums for the Claimsure backend.
 * All domain types are defined here and imported throughout the app.
 */

// ─── Role & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'patient' | 'insurance_provider';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organization_id: string | null;
  full_name: string;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export type OrgType = 'insurance_provider';

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  created_at: string;
}

// ─── Case Status Lifecycle ────────────────────────────────────────────────────

export type CaseStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'ACTION_REQUIRED'
  | 'AWAITING_REVIEW'
  | 'APPEAL_READY'
  | 'SUBMITTED'
  | 'VERIFYING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'CLOSED';

export interface Case {
  id: string;
  case_number: string;
  patient_id: string;
  insurer_org_id: string;
  service_type: string;
  service_code: string | null;
  payer_id: string | null;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
}

// ─── Denials ──────────────────────────────────────────────────────────────────

export interface Denial {
  id: string;
  case_id: string;
  denial_code: string | null;
  denial_reason: string;
  denial_date: string | null;
  appeal_deadline: string | null;
  raw_text: string | null;
  drive_file_id: string | null;
  created_at: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'denial_letter'
  | 'clinical_note'
  | 'mri_report'
  | 'lab_result'
  | 'prior_auth_form'
  | 'appeal_letter'
  | 'policy_document'
  | 'other';

export interface CaseDocument {
  id: string;
  case_id: string;
  name: string;
  document_type: DocumentType;
  drive_file_id: string;
  drive_url: string | null;
  uploaded_by: string | null;
  is_missing: boolean;
  created_at: string;
}

// ─── Appeals ──────────────────────────────────────────────────────────────────

export type AppealStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED';

export interface PolicyCitation {
  policy_id: string;
  clause: string;
  text: string;
}

export interface Appeal {
  id: string;
  case_id: string;
  status: AppealStatus;
  appeal_text: string | null;
  citations: PolicyCitation[] | null;
  approved_by: string | null;
  submitted_at: string | null;
  created_at: string;
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export type AgentNode =
  | 'parse_denial'
  | 'retrieve_requirements'
  | 'scan_evidence'
  | 'compute_gap'
  | 'route'
  | 'act'
  | 'await_human'
  | 'assemble_appeal'
  | 'verify'
  | 'escalated'
  | 'resolved';

export interface AgentState {
  id: string;
  case_id: string;
  current_node: AgentNode;
  state_data: Record<string, unknown>;
  attempt_count: number;
  is_dry_run: boolean;
  started_at: string;
  updated_at: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type ActorType = 'agent' | 'human' | 'system';

export interface AuditLog {
  id: string;
  case_id: string | null;
  actor_id: string | null;
  actor_type: ActorType;
  action: string;
  node: string | null;
  previous_state: string | null;
  new_state: string | null;
  ai_recommendation: string | null;
  human_decision: string | null;
  confidence: number | null;
  citations: PolicyCitation[] | null;
  input_hash: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'case_update'
  | 'action_required'
  | 'approval_request'
  | 'appeal_submitted'
  | 'case_resolved'
  | 'escalation';

export type NotificationChannel = 'in_app' | 'email' | 'slack';

export interface Notification {
  id: string;
  user_id: string;
  case_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  is_read: boolean;
  sent_at: string | null;
  created_at: string;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
}

// ─── API Pagination ───────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
