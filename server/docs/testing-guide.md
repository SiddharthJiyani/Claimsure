# Claimsure Backend Testing Guide

This document outlines exactly how to verify the backend is running correctly, what features it includes, and step-by-step instructions for testing the core flows.

---

## 1. Does it have what we need?

Yes. The backend has been built to support exactly what was outlined in the `implementation_plan.md` for a 2-role system (`patient` and `insurance_provider`). It includes:

1. **Authentication & RBAC:** Complete auth flow with Supabase. Patients can only see their data; insurers can only see their organization's data.
2. **Cases & Documents:** Full CRUD operations for managing medical cases and linking Google Drive document metadata.
3. **Appeals Workflow:** End-to-end API for generating, reviewing, approving, and submitting appeals.
4. **AI Orchestration:** Fire-and-forget endpoint (`POST /cases/:id/process`) to trigger the python AI agent with idempotency (so it doesn't run twice on accident).
5. **External Integrations:** Built-in service connections for Google Drive (storage), Google Sheets (mirroring), Google Calendar (deadlines), Slack (approval buttons), and Gmail (notifications).
6. **MCP Server:** Native Model Context Protocol server exposing 5 tools to the AI agents (`policy_search`, `denial_parse`, `evidence_scan`, `case_update`, `send_notification`).

---

## 2. Step 1: Basic Health Check

With your server running (`pnpm dev` in the terminal), visit this URL in your browser:

[http://localhost:5001/health](http://localhost:5001/health)

**Expected Output:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "claimsure-server",
    "version": "1.0.0",
    "environment": "development",
    "dry_run": false,
    "timestamp": "2026-09-13T00:00:00.000Z"
  }
}
```

If you see this, your Express server is successfully running and handling requests.

---

## 3. Step 2: Database Verification

Before you can test the APIs, your Supabase database must be set up.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open the **SQL Editor**.
2. Copy the contents of `server/src/database/schema.sql` and run it. (This creates your tables and security policies).
3. Copy the contents of `server/src/database/seed.sql` and run it. (This creates a fake organization and demo cases).

To verify it worked, look at the **Table Editor** in Supabase and ensure the `cases`, `profiles`, and `organizations` tables have rows in them.

---

## 4. Step 3: API Testing (Using Postman)

The easiest way to test the APIs without building a frontend first is to use Postman.

1. Open Postman.
2. Click **Import** and select the `server/Claimsure.postman_collection.json` file.
3. This will load a folder called **Claimsure API** with pre-configured requests.

### Core Flows to Test in Order:

#### A. Auth & Token Generation

1. Run the **Sign Up** request. (Or **Login** if you already created an account).
2. The response will contain a `session.access_token`.
3. Copy this token. In Postman, click on the **Claimsure API** collection folder at the top level -> go to **Variables** tab -> paste the token into the `jwt_token` variable value and save.

#### B. Read Data (Role-Based Access)

1. Run the **List Cases** request.
2. Because you are using the token of an `insurance_provider`, you will receive a paginated list of all cases belonging to your organization (created by the seed script).
3. Copy one of the `id` values from the cases returned, and paste it into the `case_id` collection variable.
4. Run the **Get Case Detail** request to see the full case data, including denials and audit logs.

#### C. Trigger the AI Agent

1. Run the **Process Case (AI Agent)** request.
2. The backend will immediately return a `200 OK` with status `ANALYZING`.
3. Behind the scenes, it will attempt to contact the AI Server (port 8000) to start the state graph. _(Note: If the AI server is not running yet, the backend will gracefully catch the failure and log it in the audit trail)._

---

## 5. Step 4: Testing the MCP Server

The MCP Server exposes the backend's capabilities to AI agents. It runs standalone and communicates over standard input/output (stdio).

To verify the MCP tools are registered correctly without an AI agent:

```bash
cd server
pnpm tsx src/mcp/mcp-server.ts
```

**Expected Output:**

```text
[INFO] MCP server initialized with 5 tools
[INFO] Claimsure MCP server running on stdio
```

_(Press `Ctrl+C` to exit after confirming)_.

---

## 6. What's Next?

With the backend fully complete and tested, the logical next steps are:

1. **The Python AI Server**: Building the LangGraph/StateGraph AI agent that will connect to the MCP server.
2. **The Frontend**: Building the Next.js/React dashboards for the Patient and Insurance Provider using these new APIs.
