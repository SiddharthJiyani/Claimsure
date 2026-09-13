-- ============================================================
-- Claimsure — PostgreSQL Schema (v3, 2-Role Architecture)
-- Run this in your Supabase SQL Editor BEFORE seeding data.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations ────────────────────────────────────────────────────────────
-- Represents insurance payer organizations (multi-tenancy).
-- Patients are not attached to an org (organization_id is NULL on their profile).

CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'insurance_provider'
                  CHECK (type IN ('insurance_provider')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users. One row per user.
-- role is enforced to EXACTLY 2 values: 'patient' | 'insurance_provider'

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('patient', 'insurance_provider')),
  organization_id UUID REFERENCES organizations (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Cases ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number     TEXT UNIQUE NOT NULL,              -- e.g. R1007
  patient_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  insurer_org_id  UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  service_type    TEXT NOT NULL,                     -- e.g. 'MRI Lumbar Spine'
  service_code    TEXT,                              -- e.g. 'CPT-72148'
  payer_id        TEXT,                              -- e.g. 'payer_a'
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN (
                      'PENDING', 'ANALYZING', 'ACTION_REQUIRED',
                      'AWAITING_REVIEW', 'APPEAL_READY', 'SUBMITTED',
                      'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED'
                    )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on case change
CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_cases_updated_at();

-- ─── Denials ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS denials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  denial_code     TEXT,
  denial_reason   TEXT NOT NULL,
  denial_date     DATE,
  appeal_deadline DATE,
  raw_text        TEXT,           -- full text extracted from denial PDF
  drive_file_id   TEXT,           -- Google Drive file ID for the denial letter
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Documents ────────────────────────────────────────────────────────────────
-- Metadata only — actual files stored in Google Drive.
-- drive_file_id is the stable Drive reference; drive_url is for convenience.

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  document_type   TEXT NOT NULL CHECK (document_type IN (
                    'denial_letter', 'clinical_note', 'mri_report',
                    'lab_result', 'prior_auth_form', 'appeal_letter',
                    'policy_document', 'other'
                  )),
  drive_file_id   TEXT NOT NULL,
  drive_url       TEXT,
  uploaded_by     UUID REFERENCES profiles (id) ON DELETE SET NULL,
  is_missing      BOOLEAN NOT NULL DEFAULT false,  -- flagged missing by AI agent
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Appeals ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appeals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN (
                      'DRAFT', 'PENDING_REVIEW', 'APPROVED',
                      'SUBMITTED', 'ACCEPTED', 'REJECTED'
                    )),
  appeal_text     TEXT,
  citations       JSONB,           -- [{policy_id, clause, text}]
  approved_by     UUID REFERENCES profiles (id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Agent State ──────────────────────────────────────────────────────────────
-- Stores resumable snapshot of the 9-node agent state machine.

CREATE TABLE IF NOT EXISTS agent_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  current_node    TEXT NOT NULL,           -- one of the 9 node names
  state_data      JSONB NOT NULL,          -- full CaseState snapshot
  attempt_count   INT NOT NULL DEFAULT 0,
  is_dry_run      BOOLEAN NOT NULL DEFAULT false,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
-- Append-only. Never DELETE or UPDATE rows in this table.

CREATE TABLE IF NOT EXISTS audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID REFERENCES cases (id) ON DELETE SET NULL,
  actor_id          UUID REFERENCES profiles (id) ON DELETE SET NULL,  -- NULL = agent action
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  action            TEXT NOT NULL,
  node              TEXT,                  -- which agent node triggered this
  previous_state    TEXT,
  new_state         TEXT,
  ai_recommendation TEXT,
  human_decision    TEXT,
  confidence        FLOAT,
  citations         JSONB,
  input_hash        TEXT,                  -- SHA-256 of input for replay detection
  idempotency_key   TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  case_id     UUID REFERENCES cases (id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN (
                'case_update', 'action_required', 'approval_request',
                'appeal_submitted', 'case_resolved', 'escalation'
              )),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'slack')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Idempotency Keys ─────────────────────────────────────────────────────────
-- Prevents duplicate write/side-effect operations.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,            -- format: case_id:action_type
  response    JSONB NOT NULL,              -- cached response body
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cases_patient_id ON cases (patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_insurer_org_id ON cases (insurer_org_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);
CREATE INDEX IF NOT EXISTS idx_denials_case_id ON denials (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents (case_id);
CREATE INDEX IF NOT EXISTS idx_appeals_case_id ON appeals (case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs (case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_agent_state_case_id ON agent_state (case_id);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Enable RLS on all tables.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE denials ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile only
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Cases: patients see only their own cases
DROP POLICY IF EXISTS "cases_patient" ON cases;
CREATE POLICY "cases_patient"
  ON cases FOR SELECT
  USING (patient_id = auth.uid());

-- Cases: insurance_provider sees all cases for their org
DROP POLICY IF EXISTS "cases_insurer" ON cases;
CREATE POLICY "cases_insurer"
  ON cases FOR SELECT
  USING (
    insurer_org_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Documents: inherit from case access
DROP POLICY IF EXISTS "documents_via_case" ON documents;
CREATE POLICY "documents_via_case"
  ON documents FOR SELECT
  USING (
    case_id IN (SELECT id FROM cases)
  );

-- Notifications: users see only their own
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Note: The Express backend uses the service role key which BYPASSES RLS.
-- RLS here acts as a second-line defense if anyone queries Supabase directly.
