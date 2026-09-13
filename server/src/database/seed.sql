-- ============================================================
-- Claimsure — Seed Data for Demo & Testing
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- These are demo accounts. Passwords are set via Supabase Auth UI.
-- ============================================================

-- ─── Step 1: Demo Organization ────────────────────────────────────────────────
INSERT INTO organizations (id, name, type) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Aetna Health Insurance', 'insurance_provider'),
  ('11111111-0000-0000-0000-000000000002', 'BlueCross BlueShield', 'insurance_provider')
ON CONFLICT (id) DO NOTHING;

-- ─── Step 2: Demo Profiles ────────────────────────────────────────────────────
-- Automatically create the users in Supabase Auth to satisfy foreign keys.
-- All passwords are set to 'password123'.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'patient@demo.claimsure.com', crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "Alex Johnson", "role": "patient"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'insurer@demo.claimsure.com', crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "Jordan Smith", "role": "insurance_provider"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'insurer2@demo.claimsure.com', crypt('password123', gen_salt('bf')), now(), '{"provider": "email", "providers": ["email"]}', '{"full_name": "Casey Williams", "role": "insurance_provider"}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) VALUES
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', format('{"sub":"%s","email":"%s"}', '22222222-0000-0000-0000-000000000001', 'patient@demo.claimsure.com')::jsonb, 'email', now(), now()),
  ('22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', format('{"sub":"%s","email":"%s"}', '22222222-0000-0000-0000-000000000002', 'insurer@demo.claimsure.com')::jsonb, 'email', now(), now()),
  ('22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', format('{"sub":"%s","email":"%s"}', '22222222-0000-0000-0000-000000000003', 'insurer2@demo.claimsure.com')::jsonb, 'email', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Demo patient (no organization)
INSERT INTO profiles (id, email, full_name, role, organization_id) VALUES
  ('22222222-0000-0000-0000-000000000001', 'patient@demo.claimsure.com', 'Alex Johnson', 'patient', NULL)
ON CONFLICT (id) DO NOTHING;

-- Demo insurance reviewer (Aetna)
INSERT INTO profiles (id, email, full_name, role, organization_id) VALUES
  ('22222222-0000-0000-0000-000000000002', 'insurer@demo.claimsure.com', 'Jordan Smith', 'insurance_provider', '11111111-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Demo insurance reviewer 2 (BlueCross)
INSERT INTO profiles (id, email, full_name, role, organization_id) VALUES
  ('22222222-0000-0000-0000-000000000003', 'insurer2@demo.claimsure.com', 'Casey Williams', 'insurance_provider', '11111111-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ─── Step 3: Demo Cases ───────────────────────────────────────────────────────

INSERT INTO cases (id, case_number, patient_id, insurer_org_id, service_type, service_code, payer_id, status) VALUES
  ('33333333-0000-0000-0000-000000000001', 'R1001', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'MRI Lumbar Spine', 'CPT-72148', 'payer_a', 'PENDING'),
  ('33333333-0000-0000-0000-000000000002', 'R1002', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Physical Therapy (12 sessions)', 'CPT-97110', 'payer_a', 'ACTION_REQUIRED'),
  ('33333333-0000-0000-0000-000000000003', 'R1003', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Outpatient Surgery — Knee Arthroscopy', 'CPT-29881', 'payer_a', 'AWAITING_REVIEW'),
  ('33333333-0000-0000-0000-000000000004', 'R1004', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'CT Scan — Abdomen/Pelvis', 'CPT-74177', 'payer_b', 'RESOLVED'),
  ('33333333-0000-0000-0000-000000000005', 'R1005', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Spinal Cord Stimulator Implant', 'CPT-63685', 'payer_a', 'ESCALATED')
ON CONFLICT (id) DO NOTHING;

-- ─── Step 4: Demo Denials ─────────────────────────────────────────────────────

INSERT INTO denials (case_id, denial_code, denial_reason, denial_date, appeal_deadline, raw_text) VALUES
  ('33333333-0000-0000-0000-000000000002',
   'CO-50',
   'Services denied as not medically necessary per payer policy section 4.2.1',
   '2026-09-01',
   '2026-10-01',
   'Your claim for CPT-97110 has been denied under code CO-50. Policy section 4.2.1 requires documented conservative treatment failure prior to PT authorization.'),

  ('33333333-0000-0000-0000-000000000003',
   'CO-96',
   'Non-covered service: prior authorization not obtained before procedure',
   '2026-09-05',
   '2026-10-05',
   'Prior authorization reference number was not present on the claim. Per payer policy section 2.1, PA is required for all elective surgical procedures.'),

  ('33333333-0000-0000-0000-000000000005',
   'CO-4',
   'Service denied: insufficient clinical documentation for medical necessity determination',
   '2026-09-08',
   '2026-10-08',
   'The submitted documentation does not meet the criteria outlined in payer policy section 8.3 for spinal cord stimulator devices. Additional diagnostic and trial period records required.')
ON CONFLICT DO NOTHING;

-- ─── Step 5: Demo Documents ───────────────────────────────────────────────────

INSERT INTO documents (case_id, name, document_type, drive_file_id, drive_url, uploaded_by, is_missing) VALUES
  ('33333333-0000-0000-0000-000000000002', 'Denial Letter - R1002.pdf', 'denial_letter', 'DEMO_DRIVE_FILE_001', NULL, '22222222-0000-0000-0000-000000000001', false),
  ('33333333-0000-0000-0000-000000000002', 'Clinical Notes - Dr. Rivera.pdf', 'clinical_note', 'DEMO_DRIVE_FILE_002', NULL, '22222222-0000-0000-0000-000000000001', false),
  ('33333333-0000-0000-0000-000000000002', 'Conservative Treatment History.pdf', 'clinical_note', 'DEMO_DRIVE_FILE_003', NULL, NULL, true),
  ('33333333-0000-0000-0000-000000000003', 'Denial Letter - R1003.pdf', 'denial_letter', 'DEMO_DRIVE_FILE_004', NULL, '22222222-0000-0000-0000-000000000002', false),
  ('33333333-0000-0000-0000-000000000003', 'PA Request Form.pdf', 'prior_auth_form', 'DEMO_DRIVE_FILE_005', NULL, NULL, true)
ON CONFLICT DO NOTHING;

-- ─── Step 6: Demo Appeal ──────────────────────────────────────────────────────

INSERT INTO appeals (case_id, status, appeal_text, citations) VALUES
  ('33333333-0000-0000-0000-000000000003', 'PENDING_REVIEW',
   'We are appealing the denial of CPT-29881 on the basis that prior authorization was obtained under reference PA-2026-00123. Please see attached PA confirmation.',
   '[{"policy_id": "payer_a_2026", "clause": "2.1", "text": "Prior authorization reference PA-2026-00123 was obtained on 2026-08-15, as documented in the attached confirmation letter."}]')
ON CONFLICT DO NOTHING;
