export const USER_ROLES = ["patient", "insurance_provider"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
};

export type CaseStatus =
  | "PENDING"
  | "ANALYZING"
  | "ACTION_REQUIRED"
  | "AWAITING_REVIEW"
  | "APPEAL_READY"
  | "SUBMITTED"
  | "VERIFYING"
  | "RESOLVED"
  | "ESCALATED"
  | "CLOSED";

export type ClaimCase = {
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
  denials?: Denial[];
  documents?: DocumentRecord[];
  appeals?: Appeal[];
  agent_state?: AgentState[];
  audit_logs?: AuditLog[];
};

export type Denial = {
  id: string;
  case_id: string;
  denial_code: string | null;
  denial_reason: string;
  denial_date: string | null;
  appeal_deadline: string | null;
  raw_text: string | null;
  drive_file_id: string | null;
  created_at: string;
};

export type DocumentRecord = {
  id: string;
  case_id: string;
  name: string;
  document_type: string;
  drive_file_id: string;
  drive_url: string | null;
  uploaded_by: string | null;
  is_missing: boolean;
  created_at: string;
};

export type Appeal = {
  id: string;
  case_id: string;
  status:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "SUBMITTED"
    | "ACCEPTED"
    | "REJECTED";
  appeal_text: string | null;
  citations: Array<{ policy_id: string; clause: string; text: string }> | null;
  approved_by: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type AgentState = {
  id: string;
  case_id: string;
  current_node: string;
  state_data: Record<string, unknown>;
  attempt_count: number;
  is_dry_run: boolean;
  started_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  case_id: string | null;
  actor_id: string | null;
  actor_type: "agent" | "human" | "system";
  action: string;
  node: string | null;
  previous_state: string | null;
  new_state: string | null;
  ai_recommendation: string | null;
  human_decision: string | null;
  confidence: number | null;
  citations: unknown;
  created_at: string;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  case_id: string | null;
  type: string;
  title: string;
  message: string;
  channel: "in_app" | "email" | "slack";
  is_read: boolean;
  sent_at: string | null;
  created_at: string;
};

export type EvalMetric = {
  name: string;
  value: string;
  target: string;
  pass: boolean;
};

export function isUserRole(
  value: string | null | undefined,
): value is UserRole {
  return value === "patient" || value === "insurance_provider";
}

export function roleHome(role: UserRole): "/patient" | "/insurance" {
  return role === "patient" ? "/patient" : "/insurance";
}

export function roleLabel(role: UserRole): string {
  return role === "patient" ? "Patient" : "Healthcare";
}
