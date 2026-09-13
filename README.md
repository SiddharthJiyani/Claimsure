# 🩺 Claimsure

> An AI-powered system designed to streamline insurance claim denial workflows using AI agents, RAG, and external application integrations.

Claimsure analyzes insurance claim denial documents, retrieves relevant policy requirements, evaluates available evidence, identifies missing documentation, and helps coordinate the next steps through AI-powered workflows.

## ✨ What It Does

- 📄 Parses insurance claim denial documents
- 🧠 Uses AI agents to analyze denial reasons
- 📚 Retrieves relevant policy information using RAG
- 🔍 Evaluates available evidence and identifies missing documentation
- 🤖 Makes structured routing decisions based on confidence and safety rules
- 👤 Escalates uncertain or sensitive cases for human review
- 🔌 Connects with external applications using MCP
- ✅ Verifies outcomes before marking workflows as complete
- 📊 Tracks agent decisions and workflow history

---

## 🏗️ Architecture

```text
                    ┌─────────────────┐
                    │     CLIENT      │
                    │                 │
                    │ Next.js + TS    │
                    └────────┬────────┘
                             │
                            HTTP
                             │
                             ▼
                    ┌─────────────────┐
                    │     SERVER      │
                    │                 │
                    │ Express + TS    │
                    │                 │
                    │ API • Cases • DB│
                    └────────┬────────┘
                             │
                            HTTP
                             │
                             ▼
                    ┌─────────────────┐
                    │    AI SERVER    │
                    │                 │
                    │ Python + FastAPI│
                    │                 │
                    │ 🧠 AI Agents    │
                    │ 📚 RAG          │
                    │ 🔄 Workflows    │
                    │ 🔌 MCP          │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Vector DB        LLM APIs      External Apps

                                      Drive • Gmail
                                      Slack • Sheets
```

---

## 📁 Project Structure

```text
Claimsure/
│
├── client/                     # Frontend application
│   └── Next.js + TypeScript
│
├── server/                     # Core backend
│   └── Express + TypeScript
│
├── ai-server/                  # AI system
│   │
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── agents/             # AI agents
│   │   ├── rag/                # RAG pipeline
│   │   ├── workflows/          # AI workflows
│   │   ├── mcp/                # MCP integrations
│   │   └── services/           # Supporting services
│   │
│   ├── data/                   # Policy documents and test data
│   ├── eval/                   # AI evaluation and testing
│   └── requirements.txt
│
├── README.md
└── .gitignore
```

---

## 🔄 Core AI Workflow

```text
Insurance Claim Denial
        │
        ▼
┌───────────────────────┐
│ Document Analysis     │
│ Agent                 │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Policy Retrieval      │
│ RAG Pipeline          │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Evidence Analysis     │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Decision & Routing    │
└───────────┬───────────┘
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
 Automate  Human  Escalate
 Action    Review
     │
     ▼
┌───────────────────────┐
│ Verification          │
└───────────────────────┘
```

---

## 🛠️ Tech Stack

### 🖥️ Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### ⚙️ Backend

- Node.js
- Express.js
- TypeScript

### 🧠 AI Server

- Python
- FastAPI
- Pydantic
- AI Agents
- RAG
- Embeddings
- Vector Database

### 🔌 Integrations

- Model Context Protocol (MCP)
- Google Drive
- Gmail
- Google Sheets
- Slack

---

## 🎯 Reliability Principles

Claimsure is designed with reliability and safety as core priorities.

- Structured AI outputs
- Schema validation using Pydantic
- Deterministic logic where AI reasoning is unnecessary
- Retrieval grounded in policy documents
- Human-in-the-loop escalation
- Confidence-based routing
- Audit logging
- Idempotent actions
- Verification after actions
- Automated evaluation and testing

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Claimsure
```

---

## 2. Start the Frontend

```bash
cd client
pnpm install
pnpm dev
```

The frontend will be available at:

```text
http://localhost:3000
```

---

## 3. Start the Backend Server

The backend requires a PostgreSQL database, Google Cloud service account, and a configured `.env` file.

Open a terminal and set up the backend:

```bash
cd server
pnpm install
```

### 3.1 Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Key configurations include your Supabase keys, Google Service Account credentials, and Slack app tokens.

### 3.2 Database Setup

Claimsure uses Supabase (PostgreSQL). Run the SQL files provided in `server/src/database/` in your Supabase SQL Editor in the following order:

1. Run `schema.sql` (Creates tables, triggers, and RLS policies)
2. Run `seed.sql` (Inserts demo users, organizations, and cases)

_Note: Ensure you have created users via Supabase Auth before running the seed data._

### 3.3 Start the Server

Start the development server:

```bash
pnpm dev
```

The backend server will run on:

```text
http://localhost:5001
```

_See `server/docs/api.md` for full API documentation._

---

## 4. Start the AI Server

Open another terminal:

```bash
cd ai-server
```

Create a Python virtual environment:

```bash
python3 -m venv venv
```

Activate it:

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload --port 8000
```

The AI server will be available at:

```text
http://localhost:8000
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

---

## 🌐 Local Development Architecture

When running locally:

```text
Frontend
http://localhost:3000
        │
        ▼
Backend
http://localhost:5001
        │
        ▼
AI Server
http://localhost:8000
```

---

## 🔌 MCP Server and AI Verification

The MCP server uses stdio, not HTTP. Start the AI server first, then open another terminal for MCP:

```bash
cd server
pnpm install
pnpm exec tsx src/mcp/mcp-server.ts
```

Expected logs:

```text
MCP server initialized with 5 tools
Claimsure MCP server running on stdio
```

The process waiting without more output is normal. Keep it running while an MCP client is connected.

### MCP Inspector

Start the Inspector from `server/` in another terminal:

```bash
cd server
pnpm dlx @modelcontextprotocol/inspector ./node_modules/.bin/tsx src/mcp/mcp-server.ts
```

Open the URL printed by the Inspector, usually `http://localhost:6274`. The Tools tab should list:

- `policy_search`
- `denial_parse`
- `evidence_scan`
- `case_update`
- `send_notification`

Test `policy_search` with:

```json
{
  "query": "What documents are required for prior authorization?",
  "payer_id": "payer_a",
  "service_code": "MRI"
}
```

The request path is:

```text
MCP Inspector
  -> server/src/mcp/tools/policy-search.ts
  -> GET http://localhost:8000/api/rag/search
  -> ai-server/app/rag/retriever.py
  -> ai-server/data/embeddings.json
```

Verify the AI server directly:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/rag/search?q=prior%20authorization&payer_id=payer_a&service_code=MRI"
```

The RAG response should contain `policy_id`, `clause`, `text`, and `score` fields.

### MCP Troubleshooting

If your prompt already shows `server`, do not run `cd server` again. Use:

```bash
pnpm exec tsx src/mcp/mcp-server.ts
```

Use `pnpm`, not `npx`, because this project declares pnpm in `devEngines`:

```bash
pnpm dlx @modelcontextprotocol/inspector ./node_modules/.bin/tsx src/mcp/mcp-server.ts
```

If `policy_search` returns `Policy search unavailable`, verify that the AI server is running at `http://localhost:8000`. If Python reports a missing package such as `numpy`, run this from `ai-server/`:

```bash
pip install -r requirements.txt
```

For initial testing, use synthetic data and set `DRY_RUN=true` in `server/.env` where supported. Test `send_notification` last because it can perform real email or Slack actions.

---

## ☁️ Deployment

Each service can be deployed independently.

```text
client/
   ↓
Vercel


server/
   ↓
Railway / Render


ai-server/
   ↓
Railway / Render
```

---
## 🖥️ Screenshot (References) 
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/fb3b71ca-42c3-4a66-ab66-ae4768b5af8d" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/98f7a2be-aa67-44ef-baf6-bc72e7735d21" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/ff6aa437-3254-4151-9247-67f24b35879f" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/ed84af47-81b9-4ac4-a938-0903b177efca" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/4a430504-8b10-447d-8d2a-bf89221713bb" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/5cf54eef-d16c-4388-bd8e-bb49a62ff475" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/372437bb-e040-4c49-a3ed-edc764cdb021" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/f944afba-0a4b-4cef-972e-a20f2d465bc1" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/137551cf-b048-4568-bb5e-19081de48196" />
<img width="2940" height="1662" alt="image" src="https://github.com/user-attachments/assets/9bbaafbf-a863-454c-b4c9-9c657fed520d" />

Screenshots for Google Mail and Calender apps 
<img width="1486" height="725" alt="Screenshot 2026-09-13 at 6 46 57 PM" src="https://github.com/user-attachments/assets/e573033c-8aa2-43c5-9432-6da5a0c68797" />
<img width="1198" height="386" alt="Screenshot 2026-09-13 at 6 48 36 PM" src="https://github.com/user-attachments/assets/f876848e-d3ae-4371-a0fc-d06c11f20e2e" />
<img width="1187" height="557" alt="Screenshot 2026-09-13 at 6 48 09 PM" src="https://github.com/user-attachments/assets/a681a589-a7ed-4277-a23e-7ce4284ec0ff" />
<img width="1199" height="564" alt="Screenshot 2026-09-13 at 6 48 00 PM" src="https://github.com/user-attachments/assets/c76af7c8-1fb7-47ce-ab9a-ac92b5ef6672" />




## 🚧 Project Status

🚧 Currently under active development.

Built for the **Multi-App Agent Hackathon** (https://multiappagenthackathon.com/).

---

## ⚠️ Disclaimer

Claimsure is a prototype built for demonstration and educational purposes. It uses synthetic or demo data and is not intended for use with real patient information or as a replacement for professional medical, legal, or insurance decision-making.
