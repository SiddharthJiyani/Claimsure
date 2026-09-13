# Claimsure Google Services Testing Guide

This guide explains how to verify Claimsure can access and use Google Drive, Google Sheets, Google Calendar, Gmail, the AI server, and MCP tools.

Use this as a demo-day checklist and as a debugging guide when something fails.

## 1. What Is Actually Connected

Claimsure currently has these Google service wrappers in the TypeScript backend:

| Service | File | Current capability |
|---|---|---|
| Google Drive | `server/src/services/google-drive.ts` | Upload, list, search, download, delete files |
| Google Sheets | `server/src/services/google-sheets.ts` | Append/update case rows |
| Google Calendar | `server/src/services/google-calendar.ts` | Create appeal deadline events |
| Gmail | `server/src/services/gmail.ts` | Send emails through Gmail API |

Claimsure also has an MCP server:

| MCP Tool | What it checks/does |
|---|---|
| `policy_search` | Calls AI-server RAG policy search |
| `denial_parse` | Reads denial metadata and Drive file info |
| `evidence_scan` | Reads case document metadata and computes missing evidence |
| `case_update` | Updates Supabase case status and mirrors to Sheets |
| `send_notification` | Creates notifications and can route to email/Slack |

Important current limitation:

The backend document upload route now accepts raw file bytes, uploads them to Google Drive, stores metadata in Supabase, and triggers the full AI agent workflow. The complete product flow is wired.

## 2. Required Environment

Backend env file:

```bash
server/.env
```

Required for Google service checks:

```env
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/oauth2callback
GOOGLE_OAUTH_REFRESH_TOKEN=your_google_oauth_refresh_token

GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_CALENDAR_ID=your_calendar_id
GMAIL_SENDER_EMAIL=sender@your-domain.com

# Optional SMTP fallback. If all SMTP values are set, SMTP is used instead of Gmail API.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=sender@gmail.com
SMTP_PASS=your_app_password
SMTP_SECURE=true
```

The service account JSON should exist here:

```text
server/credentials/google-service-account.json
```

The Drive folder must be inside a Shared Drive, and the service account must be added to that Shared Drive as a Contributor or Content manager. A folder in an individual's My Drive can be readable by a service account but cannot accept uploads because service accounts do not have personal Drive storage quota. The Sheet and Calendar must also be shared with the service account email.

For Gmail API, a normal consumer Gmail account usually will not work with a service account. Gmail through a service account requires Google Workspace domain-wide delegation. As an alternative, configure SMTP with a provider password or app password; when all SMTP values are present, Claimsure uses SMTP instead of the Gmail API.

For a personal `@gmail.com` account, OAuth2 is the recommended fix. If `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REFRESH_TOKEN` are configured, Claimsure uses OAuth2 first for Drive, Sheets, Calendar, and Gmail. That means uploads use your personal Google Drive quota instead of the service account.

## 2A. Set Up OAuth2 For Personal Gmail

Use this when your Google account is a normal `@gmail.com` account and Drive uploads fail with storage/quota errors.

1. Go to Google Cloud Console.
2. Open your Claimsure project.
3. Enable these APIs:

- Google Drive API
- Google Sheets API
- Google Calendar API
- Gmail API

4. Go to `APIs & Services -> OAuth consent screen`.
5. Choose `External`.
6. Add your Gmail address as a test user.
7. Go to `APIs & Services -> Credentials`.
8. Create an OAuth client ID.
9. Choose `Web application`.
10. Add this Authorized redirect URI:

```text
http://localhost:5001/oauth2callback
```

11. Copy the client ID and client secret into `server/.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/oauth2callback
```

12. Generate the Google consent URL:

```bash
cd server
pnpm google:oauth-url
```

Or:

```bash
./node_modules/.bin/tsx src/scripts/google-oauth.ts url
```

13. Open the printed URL.
14. Sign in with your Gmail account.
15. Approve access.
16. Google redirects to a localhost URL. The browser may show a connection error. That is okay.
17. Copy the `code=...` value from the browser address bar.
18. Exchange the code for a refresh token:

```bash
pnpm google:oauth-token -- --code=PASTE_CODE_HERE
```

Or:

```bash
./node_modules/.bin/tsx src/scripts/google-oauth.ts token --code=PASTE_CODE_HERE
```

19. Add the printed refresh token to `server/.env`:

```env
GOOGLE_OAUTH_REFRESH_TOKEN=...
```

20. Re-run the checker:

```bash
AI_SERVER_URL=http://127.0.0.1:8010 ./node_modules/.bin/tsx src/scripts/check-connections.ts
```

The checker should print:

```text
Google auth mode=oauth2
```

## 3. Install Dependencies

From the repo root:

```bash
cd server
pnpm install
```

For the AI server:

```bash
cd ../ai-server
source venv/bin/activate
pip install -r requirements.txt
```

If the venv already exists and packages are installed, you can skip the `pip install` step.

## 4. Start The AI Server

The connection checker expects the AI server to be running.

From `ai-server/`:

```bash
cd ai-server
source venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Keep this terminal open.

Expected health URL:

```text
http://127.0.0.1:8010/health
```

## 5. Run The Full Connection Checker

In a second terminal:

```bash
cd server
AI_SERVER_URL=http://127.0.0.1:8010 ./node_modules/.bin/tsx src/scripts/check-connections.ts
```

Expected output shape:

```text
[PASS] Supabase service-role DB
[PASS] Google Drive
[PASS] Google Sheets
[PASS] Google Calendar
[PASS] AI server health
[PASS] AI server RAG
[PASS] AI server eval
[PASS] MCP tools/list
[PASS] MCP policy_search call
[PASS] MCP evidence_scan call
```

Known possible failures:

```text
[FAIL] Gmail: Precondition check failed
```

This means Gmail service-account delegation is not configured. Use Google Workspace domain-wide delegation or switch to SMTP for mail.

```text
[FAIL] Slack: invalid_auth
```

This means Slack tokens are missing, placeholder, expired, or from the wrong app/workspace.

## 5A. Run A Real Google Write Test

The connection checker proves access, but it is mostly read-only. To prove Claimsure can actually use Google services, run the real Google workflow smoke test.

This command will:

- Upload a denial letter file to Google Drive
- Append a test case row to Google Sheets
- Update that same row to `ACTION_REQUIRED`
- Create an appeal deadline event in Google Calendar

It does not send Gmail or Slack messages.

From `server/`:

```bash
pnpm test:google-workflow
```

Or without relying on pnpm:

```bash
./node_modules/.bin/tsx src/scripts/test-google-workflow.ts
```

By default, it uploads:

```text
ai-server/sample_denial_letter.txt
```

Expected output:

```text
[PASS] Drive upload
  file_id: ...
  name: GOOGLE-TEST-...-sample_denial_letter.txt
  url: https://drive.google.com/...

[PASS] Sheets append row
  spreadsheet_id: ...
  case_number: GOOGLE-TEST-...
  status: PENDING

[PASS] Sheets update row
  case_number: GOOGLE-TEST-...
  new_status: ACTION_REQUIRED

[PASS] Calendar event
  event_id: ...
  summary: Claimsure Test Deadline: GOOGLE-TEST-...
  date: ...
  url: https://www.google.com/calendar/...
```

After it runs, manually verify:

1. Open the configured Drive folder and look for `GOOGLE-TEST-...-sample_denial_letter.txt`.
2. Open the configured Google Sheet and look for the `GOOGLE-TEST-...` row.
3. Confirm the row status changed from `PENDING` to `ACTION_REQUIRED`.
4. Open the configured Calendar and look for `Claimsure Test Deadline: GOOGLE-TEST-...`.

To test your own denial letter:

```bash
./node_modules/.bin/tsx src/scripts/test-google-workflow.ts --file=/absolute/path/to/your-denial-letter.pdf
```

To set your own visible case number:

```bash
./node_modules/.bin/tsx src/scripts/test-google-workflow.ts --case-number=R-DEMO-001
```

To set the deadline date:

```bash
./node_modules/.bin/tsx src/scripts/test-google-workflow.ts --case-number=R-DEMO-001 --deadline=2026-10-27
```

This is the fastest way to prove to yourself and judges that the Google integrations are not fake.

## 6. What Each Check Proves

### Supabase

The checker reads the `cases` table using the service-role key.

Pass means:

- `SUPABASE_URL` is valid
- `SUPABASE_SERVICE_ROLE_KEY` is valid
- Database tables are reachable

### Google Drive

The checker lists files from `GOOGLE_DRIVE_FOLDER_ID`.

Pass means:

- Service account key works
- Drive API is enabled
- Folder ID is valid
- Folder is shared with the service account

### Google Sheets

The checker opens `GOOGLE_SHEETS_ID` and lists sheet tabs.

Pass means:

- Sheets API is enabled
- Spreadsheet ID is valid
- Sheet is shared with the service account

For the live app, `case_update` and backend case operations can mirror status updates into Sheets.

### Google Calendar

The checker lists events from `GOOGLE_CALENDAR_ID`.

Pass means:

- Calendar API is enabled
- Calendar ID is valid
- Calendar is shared with the service account

The app can create appeal/submission deadline events when the Calendar service is called.

### Gmail

The checker verifies either Gmail API delegation or SMTP, depending on configuration.

Pass means:

- Gmail API is enabled
- Sender identity is usable by the configured auth method

Failing with `Precondition check failed` usually means the service account is not allowed to impersonate the Gmail sender.

Hackathon fallback:

Use SMTP or a transactional email provider if Gmail delegation takes too long. For Gmail SMTP, enable 2-Step Verification and create an App Password. Do not use the normal Google account password.

### AI Server

The checker verifies:

- `/health`
- `/api/rag/search`
- `/api/eval/results`

Pass means:

- AI server is running
- RAG retrieves policy clauses
- Evaluation harness results are available

### MCP

The checker starts the MCP server over stdio and verifies:

- Tool listing works
- `policy_search` returns cited RAG results
- `evidence_scan` returns a structured gap response

Pass means MCP itself is functioning and can generate proper structured responses.

## 7. Manual AI Workflow Test

From `server/`, with the AI server running:

```bash
AI_SERVER_URL=http://127.0.0.1:8010 ./node_modules/.bin/tsx -e "import 'dotenv/config'; import { processCase } from './src/services/ai-client.ts'; (async () => { const r = await processCase('11111111-1111-4111-8111-111111111111', true); console.log(JSON.stringify({ status: r.status, final_node: r.final_node, route: r.route_decision, citations: r.citations?.length ?? 0, audit: r.audit_trail.length }, null, 2)); })();"
```

Expected output:

```json
{
  "status": "ACTION_REQUIRED",
  "final_node": "await_human",
  "route": "human_review",
  "citations": 3,
  "audit": 6
}
```

This proves the TypeScript backend can call the Python AI workflow and normalize its response.

## 8. Manual Eval Harness Test

From repo root:

```bash
ai-server/venv/bin/python ai-server/eval/harness.py
```

Expected metrics:

```text
Denial classification accuracy: 100.0%
Evidence gap F1: 0.95
Routing accuracy: 100.0%
Safety escalation recall: 100.0%
Citation validity: 100.0%
Unsupported claim rate: 0.0%
```

This is the reliability proof for the hackathon.

## 9. Manual MCP Tool Test

The easiest MCP test is still the connection checker:

```bash
cd server
AI_SERVER_URL=http://127.0.0.1:8010 ./node_modules/.bin/tsx src/scripts/check-connections.ts
```

It starts:

```bash
src/mcp/mcp-server.ts
```

and calls MCP tools through the official MCP client.

## 10. Expected Demo Workflow

Ideal hackathon story:

1. A denial letter is uploaded.
2. File is stored in Google Drive.
3. Metadata is stored in Supabase.
4. Agent parses denial.
5. RAG retrieves payer policy clauses.
6. Agent scans evidence.
7. Agent computes missing documents.
8. Agent updates Sheets.
9. Agent sends patient/provider email.
10. Agent creates Calendar deadline.
11. Agent asks reviewer for approval.
12. Agent verifies whether the workflow is complete.

Current implementation status:

| Step | Status |
|---|---|
| AI upload-and-analyze endpoint | Works in Python AI server |
| RAG over local policy docs | Works |
| Evaluation harness | Works |
| MCP tool listing/calls | Works |
| Drive folder access | Works |
| Sheets access | Works |
| Calendar access | Works |
| Gmail service-account mail | Blocked unless delegation is configured |
| Backend byte upload to Drive | **Wired** — `POST /api/cases/:id/documents/upload` |
| RAG reading uploaded Drive file | **Wired** — file bytes forwarded to AI server |
| Full upload → Drive → AI → Sheets → Calendar | **Wired end-to-end** |

## 10A. Real File Upload Versus Full Product Workflow

There are two different tests:

### Test 1: Real Google service write test

Use:

```bash
cd server
./node_modules/.bin/tsx src/scripts/test-google-workflow.ts
```

This proves:

- The service account can upload files to Drive.
- The service account can append/update Sheets.
- The service account can create Calendar events.

### Test 2: Full Claimsure product workflow

Expected product flow:

```text
User uploads denial letter
-> backend uploads file bytes to Drive
-> backend stores Drive metadata in Supabase documents/denials
-> AI server parses denial text
-> RAG retrieves payer policy
-> agent scans evidence
-> agent calls Google/notification tools
```

Current gap:

The app has pieces of this, but the full flow is not wired as one endpoint yet. The real Google write test confirms Google access, while the AI upload endpoint confirms AI analysis. The missing bridge is a backend endpoint that combines them.

The bridge does this:

1. Accept multipart file upload from the client (`POST /api/cases/:id/documents/upload`).
2. Call `uploadFile()` from `server/src/services/google-drive.ts` — uploads bytes to Shared Drive.
3. Insert metadata into `documents` in Supabase (drive_file_id, drive_url).
4. If the document is a denial letter, insert/update `denials` with `drive_file_id`.
5. Call `uploadAndAnalyze()` in `server/src/services/ai-client.ts` — forwards bytes to Python AI server.
6. Python server extracts text, runs RAG, runs 9-node agent.
7. Update case status in Supabase based on agent result.
8. Mirror status to Google Sheets via `updateCaseRow()`.
9. If agent returns an appeal deadline, create Calendar event via `createAppealDeadlineEvent()`.
10. Notify patient + insurers via `notifyPatient()` / `notifyInsurersByOrg()`.

### Test the full wired flow

With the server and AI server both running:

```bash
curl -X POST http://localhost:5001/api/cases/<CASE_ID>/documents/upload \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/denial_letter.pdf" \
  -F "document_type=denial_letter" \
  -F "payer_id=payer_a" \
  -F "service_code=CPT-72148"
```

Or skip the AI step (Drive + Supabase only):

```bash
curl -X POST http://localhost:5001/api/cases/<CASE_ID>/documents/upload \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/document.pdf" \
  -F "document_type=clinical_note" \
  -F "skip_ai=true"
```

Expected response shape:

```json
{
  "success": true,
  "data": {
    "document": { "id": "...", "drive_file_id": "...", "drive_url": "https://drive.google.com/..." },
    "drive_file_id": "...",
    "drive_url": "https://drive.google.com/...",
    "denial_id": "...",
    "agent_result": {
      "status": "ACTION_REQUIRED",
      "final_node": "await_human",
      "route_decision": "human_review",
      "confidence": 0.87,
      "evidence_found": [...],
      "evidence_missing": [...],
      "appeal_text": "...",
      "citations": [...]
    },
    "case_status": "AWAITING_REVIEW",
    "calendar_event": { "id": "...", "summary": "Appeal Deadline: R123456" }
  }
}
```

## 11. Troubleshooting

### `Google Drive: file not found`

Check:

- Folder ID is correct
- Folder is shared with service account email
- Drive API is enabled in Google Cloud

### `Service Accounts do not have storage quota`

Create or use a Google Shared Drive, add the service account as a Contributor or Content manager, create the configured evidence folder inside that Shared Drive, and update `GOOGLE_DRIVE_FOLDER_ID` with that folder's ID. The Drive service includes Shared Drive support, but it cannot upload into a normal My Drive folder using service-account storage.

### `Google Sheets: The caller does not have permission`

Check:

- Sheet is shared with service account email
- Sheets API is enabled
- `GOOGLE_SHEETS_ID` is the spreadsheet ID, not the full URL

### `Google Calendar: Not Found`

Check:

- Calendar ID is correct
- Calendar is shared with service account email
- Calendar API is enabled

### `Gmail: Precondition check failed`

This is expected if using a service account without Workspace domain-wide delegation.

Options:

- Configure domain-wide delegation in Google Workspace
- Use OAuth refresh token flow for Gmail
- Use SMTP for the demo

### `Gmail: SMTP authentication failed`

Check:

- `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set
- The SMTP port and `SMTP_SECURE` match the provider
- Gmail uses an App Password, not the normal account password
- The sender address matches the SMTP account or provider policy

### `AI server health: fail`

Start the AI server:

```bash
cd ai-server
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Then rerun:

```bash
cd ../server
AI_SERVER_URL=http://127.0.0.1:8010 ./node_modules/.bin/tsx src/scripts/check-connections.ts
```

### `MCP stdio server: fail`

Check:

- Server TypeScript compiles
- `server/node_modules` exists
- AI server is running for `policy_search`

Run:

```bash
cd server
./node_modules/.bin/tsc --noEmit
```

## 12. Recommended Next Fixes

For the workflow you described, implement these next:

1. Add a real backend multipart upload endpoint that uploads bytes to Google Drive.
2. Store the returned `drive_file_id` and `drive_url` in Supabase `documents`.
3. For denial letters, create or update the matching `denials` row with `drive_file_id`.
4. Add a Drive document text extraction step that downloads Drive content and passes it to the AI server.
5. Make the AI workflow call backend/MCP tools for Sheets, Gmail, Calendar, and Slack instead of only recording intended actions.
6. Add SMTP fallback for mail if Gmail service-account delegation is not ready.
