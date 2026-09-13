-- =============================================================================
-- Claimsure demo seed
--
-- 1. Run schema.sql first
-- 2. Create two accounts in the app (or Auth dashboard):
--      patient   — any email, role Patient
--      healthcare — any email, role Healthcare (insurance_provider)
-- 3. Re-run this file. It attaches demo cases to the first matching profiles.
--
-- You can also click "Load demo cases" in either dashboard (POST /demo/seed).
-- =============================================================================

insert into public.organizations (name, type)
select 'Aetna Health', 'insurance_provider'
where not exists (
  select 1 from public.organizations where name = 'Aetna Health'
);

-- If a healthcare user signed up without a custom org, attach them to Aetna Health
update public.profiles p
set organization_id = o.id
from public.organizations o
where p.role = 'insurance_provider'
  and p.organization_id is null
  and o.name = 'Aetna Health';

do $$
declare
  v_patient uuid;
  v_org uuid;
  v_insurer uuid;
  v_case_r1007 uuid;
  v_case_r1008 uuid;
  v_case_r1009 uuid;
  v_case_r1010 uuid;
  v_case_r1011 uuid;
begin
  select id into v_patient from public.profiles where role = 'patient' order by created_at limit 1;
  select id into v_insurer from public.profiles where role = 'insurance_provider' order by created_at limit 1;
  select id into v_org from public.organizations order by created_at limit 1;

  if v_patient is null or v_org is null then
    raise notice 'No patient profile yet. Sign up as a patient, then re-run seed.sql.';
    return;
  end if;

  if exists (select 1 from public.cases where patient_id = v_patient) then
    raise notice 'Demo cases already exist for this patient. Skipping.';
    return;
  end if;

  insert into public.cases (case_number, patient_id, insurer_org_id, service_type, service_code, payer_id, status)
  values
    ('R1007', v_patient, v_org, 'MRI Lumbar Spine', 'CPT-72148', 'payer_a', 'ACTION_REQUIRED'),
    ('R1008', v_patient, v_org, 'CT Chest', 'CPT-71260', 'payer_a', 'ANALYZING'),
    ('R1009', v_patient, v_org, 'Physical Therapy', 'CPT-97110', 'payer_b', 'RESOLVED'),
    ('R1010', v_patient, v_org, 'Sleep Study', 'CPT-95810', 'payer_a', 'AWAITING_REVIEW'),
    ('R1011', v_patient, v_org, 'Knee MRI', 'CPT-73721', 'payer_b', 'PENDING')
  on conflict (case_number) do nothing;

  select id into v_case_r1007 from public.cases where case_number = 'R1007';
  select id into v_case_r1008 from public.cases where case_number = 'R1008';
  select id into v_case_r1009 from public.cases where case_number = 'R1009';
  select id into v_case_r1010 from public.cases where case_number = 'R1010';
  select id into v_case_r1011 from public.cases where case_number = 'R1011';

  insert into public.denials (case_id, denial_code, denial_reason, denial_date, appeal_deadline, raw_text)
  values
    (v_case_r1007, 'MEDNEC-04', 'Medical necessity not established — missing recent clinical notes documenting conservative therapy.', current_date - 12, current_date + 18, 'Denial: MRI lumbar spine denied. Conservative therapy documentation required per policy A §4.2.'),
    (v_case_r1008, 'AUTH-12', 'Prior authorization not on file for contrast CT.', current_date - 4, current_date + 26, 'CT chest with contrast requires prospective authorization.'),
    (v_case_r1010, 'DUP-02', 'Possible duplicate service within 12 months.', current_date - 7, current_date + 21, 'Sleep study appears duplicative of a study billed 9 months prior.');

  insert into public.documents (case_id, name, document_type, drive_file_id, is_missing, uploaded_by)
  values
    (v_case_r1007, 'Denial letter — MRI lumbar', 'denial_letter', 'drive_r1007_denial', false, v_patient),
    (v_case_r1007, 'Clinical note (last 6 months)', 'clinical_note', 'pending', true, null),
    (v_case_r1007, 'MRI order / referral', 'order', 'drive_r1007_order', false, v_patient),
    (v_case_r1008, 'Denial letter — CT chest', 'denial_letter', 'drive_r1008_denial', false, v_patient),
    (v_case_r1009, 'Appeal packet (accepted)', 'appeal_packet', 'drive_r1009_appeal', false, v_insurer),
    (v_case_r1010, 'Prior sleep study summary', 'clinical_note', 'pending', true, null);

  insert into public.appeals (case_id, status, appeal_text, citations)
  values
    (v_case_r1007, 'DRAFT', 'Appeal draft pending missing clinical note. Policy A §4.2 requires documented conservative therapy for ≥6 weeks.', '[{"policy_id":"payer_a","clause":"4.2","text":"Conservative therapy documentation required before advanced imaging."}]'::jsonb),
    (v_case_r1010, 'PENDING_REVIEW', 'Duplicate-service denial appears incorrect: prior study was a limited home study, not a facility polysomnography.', '[{"policy_id":"payer_a","clause":"9.1","text":"Home sleep tests do not satisfy facility PSG medical necessity when OSA remains unresolved."}]'::jsonb),
    (v_case_r1009, 'ACCEPTED', 'Appeal accepted. Therapy visits authorized for 8 additional sessions.', '[{"policy_id":"payer_b","clause":"2.1","text":"Continued PT authorized when functional gain is documented."}]'::jsonb);

  insert into public.agent_state (case_id, current_node, state_data, attempt_count, is_dry_run)
  values
    (v_case_r1007, 'await_human', '{"gap":["clinical_note"],"confidence":0.91,"route":"human_review"}'::jsonb, 1, true),
    (v_case_r1008, 'scan_evidence', '{"gap":["prior_auth"],"confidence":0.74,"route":"act"}'::jsonb, 1, true),
    (v_case_r1010, 'await_human', '{"gap":[],"confidence":0.86,"route":"human_review"}'::jsonb, 1, true);

  insert into public.audit_logs (case_id, actor_id, actor_type, action, node, previous_state, new_state, ai_recommendation, confidence)
  values
    (v_case_r1007, null, 'agent', 'parse_denial', 'parse_denial', 'PENDING', 'ANALYZING', 'Classified as medical-necessity denial (MEDNEC-04)', 0.94),
    (v_case_r1007, null, 'agent', 'compute_gap', 'compute_gap', 'ANALYZING', 'ACTION_REQUIRED', 'Missing clinical_note per policy A §4.2', 0.91),
    (v_case_r1010, null, 'agent', 'route', 'route', 'ANALYZING', 'AWAITING_REVIEW', 'Duplicate-service conflict needs human review', 0.86),
    (v_case_r1009, v_insurer, 'human', 'approve_appeal', 'await_human', 'APPEAL_READY', 'RESOLVED', null, null);

  insert into public.notifications (user_id, case_id, type, title, message, channel, sent_at)
  values
    (v_patient, v_case_r1007, 'action_required', 'Clinical note needed', 'Your MRI lumbar claim R1007 needs a recent clinical note before the appeal can be filed.', 'in_app', now()),
    (v_patient, v_case_r1007, 'case_update', 'Denial explained', 'Aetna Health denied MRI lumbar spine because conservative therapy is not documented.', 'in_app', now() - interval '1 day');

  if v_insurer is not null then
    insert into public.notifications (user_id, case_id, type, title, message, channel, sent_at)
    values
      (v_insurer, v_case_r1007, 'approval_request', 'Gap flagged on R1007', 'Agent abstained from auto-appeal until the missing clinical note is uploaded.', 'in_app', now()),
      (v_insurer, v_case_r1010, 'approval_request', 'Review ready — R1010', 'Sleep study duplicate-service denial is ready for human review.', 'in_app', now());
  end if;

  raise notice 'Demo cases seeded for patient %', v_patient;
end $$;
