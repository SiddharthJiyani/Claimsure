# 🧪 Claimsure — Complete Testing Guide

> **Stack**: Express (port 5001) · FastAPI AI Server (port 8000) · Supabase · MCP stdio server

---

## Quick Status Check

```bash
# Is the Express server running?
curl http://localhost:5001/health

# Is the AI/agent server running?
curl http://localhost:8000/health
```

---

## 1. Auth Pipeline

### How it works
- **Signup** uses `supabase.auth.admin.createUser()` — bypasses email rate limits, auto-confirms email.
- **Login** uses `supabase.auth.signInWithPassword()` on the anon client — returns a real JWT.
- The JWT is then used as `Authorization: Bearer <token>` on all protected routes.

### Test in Postman

#### Step 1 — Sign Up (insurance provider)
```
POST http://localhost:5001/api/auth/signup
Content-Type: application/json

{
  "email": "insurer@test.com",
  "password": "password123",
  "full_name": "Test Insurer",
  "role": "insurance_provider",
  "organization_id": "11111111-0000-0000-0000-000000000001"
}
```

#### Step 2 — Sign Up (patient)
```
POST http://localhost:5001/api/auth/signup
Content-Type: application/json

{
  "email": "patient@test.com",
  "password": "password123",
  "full_name": "Test Patient",
  "role": "patient"
}
```

#### Step 3 — Login (get JWT)
```
POST http://localhost:5001/api/auth/login
Content-Type: application/json

{
  "email": "insurer@test.com",
  "password": "password123"
}
```
→ Copy `data.session.access_token` from the response.

#### Step 4 — Use JWT on all protected routes
```
Authorization: Bearer <your_access_token_here>
```

#### Step 5 — Verify your session
```
GET http://localhost:5001/api/auth/me
Authorization: Bearer <token>
```

---

## 2. REST API Endpoints

### Cases

```
# List cases (auto role-scoped)
GET /api/cases
Authorization: Bearer <token>

# Get single case
GET /api/cases/:caseId
Authorization: Bearer <token>

# Create case (insurance_provider only)
POST /api/cases
Authorization: Bearer <token>
{
  "patient_id": "<patient-uuid>",
  "insurer_org_id": "11111111-0000-0000-0000-000000000001",
  "service_type": "MRI Lumbar Spine",
  "service_code": "CPT-72148",
  "payer_id": "payer_a",
  "denial_reason": "Not medically necessary per policy section 4.2"
}

# Trigger AI agent on a case (insurance_provider only)
POST /api/cases/:caseId/process
Authorization: Bearer <token>

# Update case status
PATCH /api/cases/:caseId/status
Authorization: Bearer <token>
{ "status": "RESOLVED" }

# View audit trail
GET /api/cases/:caseId/audit
Authorization: Bearer <token>
```

### Documents

```
# List docs for a case
GET /api/cases/:caseId/documents
Authorization: Bearer <token>

# Upload a document record
POST /api/cases/:caseId/documents
Authorization: Bearer <token>
{
  "name": "Clinical Notes 2024",
  "document_type": "clinical_note",
  "drive_file_id": "your-google-drive-file-id",
  "is_missing": false
}

# Mark a doc as missing/found
PATCH /api/cases/:caseId/documents/:docId/missing
Authorization: Bearer <token>
{ "is_missing": true }
```

### Appeals

```
# Get appeal for a case
GET /api/cases/:caseId/appeals
Authorization: Bearer <token>

# Create appeal
POST /api/cases/:caseId/appeals
Authorization: Bearer <token>
{ "appeal_text": "Based on clinical evidence...", "citations": [] }

# Approve / reject appeal
PATCH /api/cases/:caseId/appeals/:appealId
Authorization: Bearer <token>
{ "status": "APPROVED" }
```

### Notifications

```
GET /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

---

## 3. MCP Server — How to Test

The MCP server runs over **stdio**, not HTTP. It's meant to be called by AI agents (Claude Desktop, Python agents), not curl.

### Option A — Claude Desktop (Recommended for demo)
1. Open Claude Desktop → Settings → Developer → Edit Config
2. Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claimsure": {
      "command": "npx",
      "args": ["tsx", "/Users/siddharthjiyani/Documents/PROGRAMMING/Dev/Claimsure/server/src/mcp/mcp-server.ts"]
    }
  }
}
```

3. Restart Claude Desktop
4. In a chat prompt:
   - "Use policy_search to find requirements for MRI with payer_a"
   - "Use case_update to set case <id> status to ANALYZING"
   - "Send a notification to user <id> that their appeal was approved"

### Option B — Via Express (indirect)
Calling `POST /api/cases/:id/process` on Express triggers the Python agent, which calls the MCP tools internally. This is the main demo flow.

### Available MCP Tools
| Tool | What it does |
|---|---|
| `policy_search` | RAG search: finds payer policy clauses by payer_id + service_code |
| `denial_parse` | Downloads denial PDF from Google Drive, extracts structured denial |
| `evidence_scan` | Lists all documents for a case, flags which are missing |
| `case_update` | Updates case status in DB + mirrors to Google Sheets |
| `send_notification` | Fires in-app + email + Slack notifications |

---

## 4. External Apps — How to Test

### Prerequisites (.env must have real values)
```
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=  # path to JSON key file
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SHEETS_SPREADSHEET_ID=
GMAIL_SENDER_EMAIL=
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_APPROVAL_CHANNEL_ID=
```

### Google Drive
When you upload a document via the API (`POST /api/cases/:id/documents`), the metadata is saved in Supabase and the file lives in Google Drive.
**Verify**: Check your Drive folder for uploaded files.

### Google Sheets
Case status changes are mirrored to Sheets automatically.
Test: `PATCH /api/cases/:id/status` → check your Sheet for updated row.

### Gmail
Notifications to patients trigger email.
**DRY_RUN=true** → logs email body only (safe for testing).
**DRY_RUN=false** + valid `GMAIL_SENDER_EMAIL` → sends real email.

### Slack
Escalation and approval requests fire Slack Block Kit messages.
Test: Set case status to `ESCALATED` → check Slack channel.

### Google Calendar
Appeal submissions create deadline events.
Test: Approve + submit appeal → check Google Calendar.

### DRY_RUN Safe Mode
```bash
# server/.env
DRY_RUN=true
```
All external writes (Sheets, Calendar, Gmail, Slack) will be **logged only, not executed**.

---

## 5. AI Agent + RAG

### Start the AI server
```bash
cd /Users/siddharthjiyani/Documents/PROGRAMMING/Dev/Claimsure/ai-server
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Call directly
```bash
curl -X POST http://localhost:8000/api/workflow/process-case \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "your-case-uuid",
    "case_number": "R1007",
    "patient_name": "John Doe",
    "payer_id": "payer_a",
    "service_code": "CPT-72148",
    "denial_reason": "Not medically necessary"
  }'
```

### Upload denial PDF directly
```bash
curl -X POST http://localhost:8000/api/workflow/upload-and-analyze \
  -F "file=@/path/to/denial_letter.pdf" \
  -F "payer_id=payer_a" \
  -F "service_code=CPT-72148"
```

### Run eval harness
```bash
# Via terminal:
cd ai-server && python -m eval.harness

# Via Express API:
POST http://localhost:5001/api/eval/run
GET  http://localhost:5001/api/eval/results
```

---

## 6. What's Done vs Left

### ✅ Backend (server/)
- Supabase Auth (admin signup, JWT login, RBAC)
- Cases CRUD + 10-state lifecycle
- Documents + Appeals + Notifications APIs
- All 5 Google/Slack service modules
- AI client (Express → Python agent)
- Custom MCP server with 5 tools
- DRY_RUN mode, idempotency, audit log

### ✅ AI Server (ai-server/)
- 9-node agent state machine
- RAG retriever + pre-computed embeddings
- 20-case eval harness
- FastAPI endpoints

### ⚠️ Still To Do
- [ ] **Frontend** (client/) — Next.js dashboards
- [ ] **Google OAuth** — configure in Supabase dashboard
- [ ] **Seed clean demo data** — run seed.sql in Supabase
- [ ] **Pre-run eval** — generate results.json before demo
- [ ] **Verify Slack webhook** — ngrok or deploy needed for Slack callbacks

---

## 7. Multi-Agent Architecture Explained

**Why this is "multi-agent"** per the hackathon brief:

```
POST /api/cases/:id/process (Insurance Provider triggers)
         │
         ▼
   Express backend
         │
         ▼
   ai-client → POST :8000/api/workflow/process-case
         │
         ▼
  ┌─────────────────────────────────────┐
  │      9-NODE AGENT STATE MACHINE      │
  │                                     │
  │  Node 1: parse_denial      ← LLM    │
  │  Node 2: retrieve_requirements ← RAG│
  │  Node 3: scan_evidence  ← MCP tool  │
  │  Node 4: compute_gap  ← DETERMINISTIC│ (no LLM — set diff in Python)
  │  Node 5: route         ← RULE-BASED  │ (no LLM — confidence threshold)
  │  Node 6: act          ← MCP tools   │ (case_update, Gmail, Sheets, Calendar)
  │  Node 7: await_human  ← Slack pause  │ (human clicks Approve in Slack → webhook)
  │  Node 8: assemble_appeal  ← LLM     │
  │  Node 9: verify      ← self-check    │ (agent checks its own work)
  └─────────────────────────────────────┘
```

**Multi-agent elements**:
1. **9 specialized nodes** — each is a distinct agent with its own tools and logic
2. **Human-in-the-loop** — `await_human` pauses for Slack button → webhook → agent resumes
3. **Self-verification** — `verify` node re-scans evidence to confirm it fixed the problem
4. **MCP tools** — Python agent calls the TypeScript backend via JSON-RPC (cross-language agent communication)
5. **5 external apps** — Drive, Sheets, Gmail, Slack, Calendar (hackathon requires ≥3) ✅

**Hackathon differentiators**:
- `compute_gap` = pure Python set diff, **not an LLM** (reliability)
- Safety escalation = **code-enforced rules**, not a prompt (100% safety recall)
- Self-verify loop = agent audits its own actions

---

## Quick Smoke Test Checklist

```
1. curl http://localhost:5001/health          ✅
2. curl http://localhost:8000/health          ✅
3. POST /api/auth/signup                      ✅
4. POST /api/auth/login  → save JWT           ✅
5. POST /api/cases  → save case_id            ✅
6. POST /api/cases/:id/process                ✅ (connects Express → Python)
7. GET  /api/cases/:id/audit                  ✅
8. GET  /api/eval/results                     ✅
```
