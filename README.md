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

Open another terminal:

```bash
cd server
pnpm install
pnpm dev
```

The backend server will run on:

```text
http://localhost:5000
```

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
http://localhost:5000
        │
        ▼
AI Server
http://localhost:8000
```

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

## 🚧 Project Status

🚧 Currently under active development.

Built for the **Multi-App Agent Hackathon** (https://multiappagenthackathon.com/).

---

## ⚠️ Disclaimer

Claimsure is a prototype built for demonstration and educational purposes. It uses synthetic or demo data and is not intended for use with real patient information or as a replacement for professional medical, legal, or insurance decision-making.
