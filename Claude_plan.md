# Context Handoff — Claude

> **ContextCarrier Export** — Attach this file to a new chat to continue your conversation.

| Field                 | Value                |
| --------------------- | -------------------- |
| **Source**            | Claude               |
| **Date**              | 12/09/2026, 09:11:22 |
| **Export Mode**       | Full Export          |
| **Total Messages**    | 2                    |
| **Exported Messages** | 2                    |

---

## Instructions for AI

You are being provided with exported context from a previous conversation that reached its context window limit. Please:

1. Read the full conversation below carefully
2. Briefly recap the current state in 2–3 sentences
3. Continue the conversation from where it left off

---

## Conversation Transcript

### 👤 User

tell me the whole detailed implementation planing from strat to end workflow, incudling which technongies to be used like typescript, RAG, python aprt from that how can i connect external apps, using the apporach of MCP ., giove me step by step plan , also guide me with the number of the apps that can be used , and am making this for the hackathan i will orivide wiht it
https://multiappagenthackathon.com/ the juding criteria
JUDGING 30% Technical execution 25% Reliability & evaluation 20% Usefulness 15% Originality 10% Demo clarity

---

### 🤖 Assistant

I'll pull the actual hackathon rules first, since the app count and submission requirements should drive the plan.

Your build window is **6.5 hours** (Sunday Sept 13, 9:30 AM–4:00 PM PT), and the brief asks for **at least three external apps**, a working repo, a **two-minute** demo, and a **system + reliability brief**. That changes almost everything about the plan in your doc. The Claimsure concept is right. The five-app, LangGraph, FAISS, Streamlit, 20-case version is a three-day build. Below is the version that actually ships by 4 PM and scores well against the rubric.

---

### 1. What the rubric is actually telling you

| Weight | Criterion                | What wins it                                | Cheapest way to get it                                     |
| ------ | ------------------------ | ------------------------------------------- | ---------------------------------------------------------- |
| 30%    | Technical execution      | A real multi-step agent, not a prompt chain | LangGraph-style state machine + your own MCP server        |
| 25%    | Reliability & evaluation | Numbers from a real test run                | 20-case golden set + npm run eval that prints a table      |
| 20%    | Usefulness               | Judges believe a clinic would use it        | One narrow, painful workflow done end-to-end               |
| 15%    | Originality              | Not "AI writes an appeal letter"            | The verification loop and the refusal-to-decide escalation |
| 10%    | Demo clarity             | 2 minutes, no dead air                      | Pre-seeded state, scripted, one rehearsal                  |

Reliability is 25% and almost nobody builds it. That's your edge. Budget a full hour for the eval harness even if it means cutting a feature.

---

### 2. Scoped spec: what's in, what's cut

**In (the demo path):**

- Ingest one denial letter PDF → extract structured denial reason

- RAG over payer policy documents → identify required evidence

- Check Drive for which required documents exist → compute the gap

- Route: automatable vs human-review

- Act across apps: update Sheets, send Gmail, post Slack approval, create Calendar deadline

- Human approves in Slack → agent assembles appeal packet → re-verifies → marks resolved

- Audit log for every decision and tool call

**Cut (say these are "next"):**

- Real EHR/FHIR, real payer portals, multi-tenant auth, OCR of scanned faxes, fine-tuning, a vector database service, user login, more than one payer policy corpus.

Ten cases in the dataset is enough if the labels are real. Twenty is better and costs you 20 minutes with an LLM generating them tonight.

---

### 3. Stack: go TypeScript, single repo

Given your background (JS/TS, HTML/CSS, UX) and a 6.5-hour clock, Python + Streamlit buys you nothing and costs you a language switch plus an ugly demo. TypeScript keeps the agent, the MCP server, and the dashboard in one process and one deploy.

| Layer               | Choice                                            | Why                                                                  |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Runtime             | Node 20+, TypeScript, pnpm                        | One language                                                         |
| App                 | Next.js (App Router)                              | Dashboard + API routes + a place to host the MCP server              |
| Agent orchestration | LangGraph.js, or a hand-rolled state machine      | See note below                                                       |
| LLM calls           | Vercel AI SDK (ai) with Anthropic or OpenAI       | Built-in MCP client, tool-calling, streaming                         |
| MCP                 | @modelcontextprotocol/sdk                         | Both the client and your own server                                  |
| RAG                 | In-memory: chunk → embeddings → cosine similarity | 40 lines. Do not install a vector DB                                 |
| PDF parsing         | pdf-parse or unpdf                                | Text-layer PDFs only; generate your synthetic PDFs with a text layer |
| Persistence         | SQLite via better-sqlite3 (or just JSON files)    | Audit log + case state                                               |
| Tracing             | Your own JSONL trace writer + a "Trace" tab       | No vendor setup, demos beautifully                                   |
| UI                  | Tailwind + shadcn/ui                              | You'll make this look better than anyone else's Streamlit            |

**On LangGraph.js:** use it only if you've written it before. If not, a plain `while` loop over a typed state object with a `step` discriminator is 60 lines, debuggable, and judges cannot tell the difference. Do not learn a framework during the build window.

Python only if you insist on a library that has no TS equivalent. You don't have one here.

---

### 4. How many apps, and which

Minimum is three. Aim for **five apps across two credential setups**, which is the efficiency trick:

| #   | App             | Role in the loop                           | Auth                       | Setup cost |
| --- | --------------- | ------------------------------------------ | -------------------------- | ---------- |
| 1   | Google Drive    | Evidence repository the agent searches     | Google service account     | Low        |
| 2   | Google Sheets   | Case management DB, visible state changes  | Same service account       | Low        |
| 3   | Google Calendar | Appeal deadline + peer-to-peer review slot | Same service account       | Low        |
| 4   | Gmail           | Outbound comms to provider admin           | Google OAuth refresh token | Medium     |
| 5   | Slack           | Human-in-the-loop approval with buttons    | Bot token + Socket Mode    | Low        |

Two critical setup notes:

- **Service account for Drive/Sheets/Calendar.** Create it in Google Cloud, download the JSON key, then _share_ the Drive folder, the Sheet, and a Calendar with the service account's email address. This skips the OAuth consent screen entirely. Huge time saver.

- **Gmail cannot use a service account** without Workspace domain-wide delegation. Either get a refresh token tonight via the OAuth playground with the `gmail.send` scope, or swap Gmail for Resend/SMTP. If Gmail auth is fighting you at 10 AM tomorrow, drop it and keep four apps. You're still over the minimum.

- **Slack Socket Mode** avoids needing a public HTTPS endpoint for interactive buttons. No ngrok, no tunnel. Enable Socket Mode, get an app-level token (`xapp-`), use `@slack/bolt`.

A sixth app adds nothing to the score if it doesn't visibly do work in the two-minute demo. Judges read decoration as padding.

---

### 5. The MCP architecture

This is the part that earns technical execution points, so be deliberate about it.

Your agent is an **MCP client**. It talks to two categories of server:

**Why build your own MCP server instead of plain functions?** Because it proves you understand the protocol rather than just consuming it, it makes your domain logic reusable by any MCP client (mention in the brief that a clinic could point Claude Desktop at it), and it gives you a clean seam for the dry-run mode your eval harness needs.

#### 5a. Your MCP server (the differentiator)

Create `packages/claimsure-mcp`. Expose narrow, typed tools:

Tool design rules that matter for reliability:

- **Every tool returns structured JSON**, never prose. The agent parses, it doesn't interpret.

- **Every retrieval tool returns a citation id.** Later you validate that every claim in the agent's output references a real `policy_id`. That is your hallucination check.

- **Write tools take an `idempotency_key`** (the case id + action type). Re-running the graph must not send two emails.

- **Every tool honors a `DRY_RUN` env flag.** In dry-run it returns a recorded fixture and logs the intended call instead of executing. This is what makes the 20-case eval runnable in 90 seconds without spamming Slack.

#### 5b. Connecting the third-party servers (MCP client side)

Verify the exact export names against the current AI SDK and MCP SDK docs when you scaffold. The API around MCP clients has been moving.

**The pragmatic fallback you should plan for:** third-party MCP servers for Google Workspace vary a lot in quality and some will not expose the exact operation you need (creating a Calendar event with a specific attendee, appending a Sheets row). If a community server fights you for more than 20 minutes, **wrap `googleapis` directly as tools inside your own MCP server**. You still have a genuine MCP architecture, the apps are still connected, and you've lost 20 minutes instead of three hours. Decide this by 11 AM and don't revisit it.

Route your Slack _approval_ flow through Bolt with Socket Mode directly rather than through MCP, because you need to receive an inbound interaction, not just make an outbound call. MCP tools are for the agent calling out.

---

### 6. Agent design

State object, and the whole graph operates on this:

Nodes, in order:

1. - `parse_denial` — PDF → `{code, reason_text, deadline}`. Constrained JSON output, validated with Zod. Retry once on schema failure, then abstain.

2. - `retrieve_requirements` — `policy_search` against the payer's policy for that service code.

3. - `scan_evidence` — list Drive folder, match filenames + extracted content against requirements.

4. - `compute_gap` — deterministic set difference. **Do not let the LLM do this.** Code it. Deterministic code where possible is a reliability talking point.

5. - `route` — decision rules, not vibes:

- missing docs, all requirements cited, confidence ≥ 0.75 → `automatable`

- conflicting documents, or denial reason mentions medical necessity, or confidence < 0.75, or a requirement has no citation → `human_review`

- policy not found for this payer/code → `abstain`

6. - `act` — Sheets update, Gmail send, Calendar deadline event, Slack post. Each with idempotency key.

7. - `await_human` — Slack Block Kit with Approve / Reject / Request more info. Graph pauses; state persists to SQLite.

8. - `assemble_appeal` — only after evidence gap closes. Produces a packet with a citation for every assertion.

9. - `verify` — re-run `scan_evidence` and `compute_gap` against the current Drive state. If the gap is closed and the appeal was sent, `resolved`. If not, increment attempt counter, `escalate` after 2 attempts.

The `verify` node is your originality. Most teams stop at step 6. Say out loud in the demo: "the agent checks whether its own action actually worked."

---

### 7. RAG, kept small

Do not install FAISS or Chroma. 6.5 hours.

- 2 payer policy documents, roughly 1,500 words each, written tonight by an LLM. Each requirement in its own short numbered clause so chunking is trivial.

- Chunk on clause boundaries, tag each chunk with `{payer_id, service_codes[], policy_id, section}`.

- Embed once at build time with `text-embedding-3-small`, save `embeddings.json` to disk. Load into memory at boot.

- Search: **filter by `payer_id` and `service_code` first**, then cosine similarity over the survivors. Metadata filtering before vector search is what makes a small corpus behave correctly and is worth one sentence in your brief.

- Return top-k with scores. If the top score is below a threshold, return empty and let the agent abstain rather than retrieving something irrelevant.

That's about 60 lines and it will outperform a rushed Chroma setup.

---

### 8. Reliability and evaluation (the 25% almost nobody builds)

#### The dataset

`data/cases.json`, 20 cases, each with golden labels:

Composition matters more than count. **15 happy-ish cases, 5 adversarial:**

- medical necessity ambiguous → must route `human_review`

- clinical notes contradict the referral → must route `human_review`

- payer policy missing for that code → must `abstain`

- deadline already passed → must escalate, not send a doomed appeal

- patient identifier mismatch between denial and chart → must halt

Those five are the ones you report on. "20/20 safety-critical cases correctly escalated" is the single most quotable number in your brief.

#### The harness

`pnpm eval` runs the graph in `DRY_RUN=1` over all 20 cases, writes `eval/results.json` and prints:

| Metric                         | How computed                                         | Target    |
| ------------------------------ | ---------------------------------------------------- | --------- |
| Denial classification accuracy | exact match on denial_code                           | ≥ 85%     |
| Evidence gap F1                | set F1 of missing_evidence                           | ≥ 0.80    |
| Routing accuracy               | exact match on route                                 | ≥ 90%     |
| Safety escalation recall       | of the 5 unsafe cases, % routed human/abstain        | 100%      |
| Citation validity              | % of assertions whose policy_id exists in the corpus | 100%      |
| Unsupported claim rate         | assertions with no citation ÷ total                  | 0%        |
| Median latency / case          | wall clock                                           | report it |
| Tool call failures recovered   | injected failures that the retry path survived       | report it |

Run it three times and report variance. Temperature 0, pinned model version, fixed fixtures. If a metric is bad, **report it honestly and say what you'd fix**. Judges who care about evaluation respect a real 82% far more than a suspicious 100%.

#### Cheap reliability features to build and then mention

- Zod validation on every LLM structured output, one retry, then abstain

- Timeout + 2 retries with backoff on every external app call

- Idempotency keys so a replay never double-sends

- Append-only JSONL audit log: timestamp, case, node, input hash, tool, output, decision, confidence

- `DRY_RUN` global kill switch

- Synthetic data only, no real PHI, stated explicitly

- A hard rule that the agent never asserts medical necessity, enforced in the routing code and not only in the prompt

That last point is worth saying explicitly on camera. "The constraint is in code, not in the prompt."

---

### 9. Tonight (before 9 AM PT tomorrow)

First: **read the official rules on what pre-work is allowed.** The site says rules are available before registration. Many one-day hackathons permit setup and scaffolding but not pre-written core logic. Assume auth setup, accounts, and synthetic data are fine, and that agent logic should be written during the window. If unclear, ask the organizers in the Discord/email at opening.

Safe prep list, roughly 2–3 hours:

- Google Cloud project, enable Drive + Sheets + Calendar + Gmail APIs

- Service account + JSON key; share a Drive folder, a Sheet, and a Calendar with its email

- Gmail OAuth refresh token with `gmail.send` scope (or set up Resend as the fallback)

- Slack app: bot token, Socket Mode on, app-level token, invite bot to `#claimsure`

- LLM API key, billing confirmed working

- Generate synthetic data: 2 payer policies, 20 denial letters as text-layer PDFs, ~40 clinical documents. Have an LLM write them, script the PDF generation.

- Write `data/cases.json` golden labels **by hand** while generating, so labels are trustworthy

- Upload evidence files to Drive, leaving specific gaps that match your labels

- Verify each of the 5 apps with a one-line smoke test script. **Do not discover a broken credential at 11 AM.**

- `pnpm create next-app`, Tailwind, shadcn, empty repo pushed

Sleep. Seriously.

---

### 10. Hour-by-hour, 9:30 AM – 4:00 PM PT

| Time        | Block                               | Done means                                                                                         |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| 9:30–10:00  | Skeleton                            | Repo runs, env loaded, all 5 app clients smoke-tested green                                        |
| 10:00–10:45 | claimsure-mcp v1                    | policy_search + denial_parse working over the real corpus, callable from the agent                 |
| 10:45–11:30 | Graph core                          | parse → retrieve → scan → gap → route produces correct CaseState for case R1007 in the terminal    |
| 11:30–12:15 | Act layer                           | Sheets row updates, Gmail sends, Calendar event created, Slack message posts. Idempotency keys in. |
| 12:15–12:30 | Lunch, away from the screen         |                                                                                                    |
| 12:30–1:15  | Human loop + verify                 | Slack Approve button resumes the graph; verify re-scans and closes the case                        |
| 1:15–2:00   | Eval harness                        | pnpm eval prints the metrics table for all 20 cases. Non-negotiable.                               |
| 2:00–2:45   | Dashboard                           | Case list, one case detail view with reasoning + citations + trace, live-ish status                |
| 2:45–3:05   | Freeze                              | No new features. Seed demo state. Record a backup screen capture of the full flow.                 |
| 3:05–3:30   | Demo record + rehearse              | 2:00 or under, twice                                                                               |
| 3:30–4:00   | Reliability brief + README + submit | Submitted with 10 minutes to spare                                                                 |

Hard cut lines if you're behind:

- Behind at 11:30 → drop Calendar, drop Gmail, go to three apps (Drive, Sheets, Slack)

- Behind at 1:15 → drop the dashboard, demo the terminal + the real Slack/Sheets/Gmail side by side. **Never cut the eval harness.** A terminal demo with real numbers beats a pretty dashboard with none.

---

### 11. The two-minute demo script

Two minutes is brutally short. Every second scripted. Pre-seed 24 cases so the dashboard looks alive on frame one.

- **0:00–0:12** Problem, one breath. "A clinic gets a prior-auth denial. Figuring out why, what's missing, who acts, and whether it worked takes staff hours per case."

- **0:12–0:25** "Claimsure is an agent across Drive, Sheets, Gmail, Slack and Calendar. It never decides medical necessity."

- **0:25–1:00** Run case R1007. Show on screen: denial reason extracted, policy requirement retrieved **with citation**, evidence found, one document missing. Then cut to the real Sheet row flipping to ACTION REQUIRED, the real Gmail draft, the real Calendar deadline.

- **1:00–1:20** Drop the missing PDF into Drive. Re-run. "It re-verifies its own work." Appeal packet assembles, Slack approval card appears, you click Approve, status goes RESOLVED.

- **1:20–1:40** The unsafe case. Ambiguous medical necessity. Agent refuses, escalates to Slack. "This constraint is in code, not in the prompt."

- **1:40–2:00** Eval table on screen. Read three numbers aloud, including the safety one, including the one that isn't perfect.

Record it. Do not demo live. A recorded demo with a live app open as backup is the professional move.

---

### 12. The system + reliability brief

One page, seven sections. Judges skim, so lead each with the answer.

1. - **Problem and user** (3 sentences, one concrete number about prior-auth burden)

2. - **Architecture** (the diagram above, plus which apps do what)

3. - **Why MCP** (own server for domain logic, clients for apps, reusable by any MCP host)

4. - **Agent loop** (the 9 nodes, and which are deterministic code vs LLM. Emphasize the gap computation is code.)

5. - **Evaluation** (dataset composition, the metrics table, variance across 3 runs)

6. - **Failure modes and mitigations** (schema failure → retry → abstain; tool failure → backoff → escalate; retrieval miss → abstain not guess; replay → idempotency keys)

7. - **Limits and scope** (synthetic data only, no PHI, no medical-necessity decisions, two payers, text-layer PDFs only, not HIPAA-compliant, not deployed)

Section 7 gains you points rather than losing them. Stating limits precisely is a reliability signal.

---

### 13. The three things most likely to sink you

1. - **OAuth at 11 AM.** Kill this tonight with the service account approach and smoke tests.

2. - **Framework learning during the window.** If you haven't shipped LangGraph.js before, write the loop yourself.

3. - **Building features until 3:50.** Freeze at 2:45. An unrecorded demo is a zero on 10% and hurts the other 90% by association.
