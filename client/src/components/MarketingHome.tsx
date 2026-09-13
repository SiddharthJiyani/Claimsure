import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FolderOpen,
  Lock,
  Scale,
  Shield,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";

const NODES = [
  {
    title: "Parse denial",
    copy: "Extract the denied service, codes, and payer language from the letter or notice.",
  },
  {
    title: "Retrieve policy",
    copy: "Pull the relevant coverage clauses instead of relying on a generic summary.",
  },
  {
    title: "Scan evidence",
    copy: "Inventory what is already on the case: notes, orders, imaging, and labs.",
  },
  {
    title: "Compute gap",
    copy: "Compare required evidence to what is present. Missing vs found is a set difference.",
  },
  {
    title: "Route",
    copy: "Decide whether to request documents, draft an appeal, or stop for a human.",
  },
  {
    title: "Act",
    copy: "Ask the patient for a specific record or prepare the next operational step.",
  },
  {
    title: "Human review",
    copy: "Healthcare reviewers approve, reject, or escalate before anything is submitted.",
  },
  {
    title: "Assemble appeal",
    copy: "Draft a citation-backed packet tied to the clauses the agent retrieved.",
  },
  {
    title: "Verify",
    copy: "Re-check the gap after new evidence lands and close the loop on the case.",
  },
];

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: "Deterministic evidence gaps",
    copy: "The agent does not invent missing records. It compares payer requirements to the documents already attached to the case.",
  },
  {
    icon: Scale,
    title: "Citation-backed recommendations",
    copy: "Every suggested next step points at a retrieved policy clause, so reviewers can see why the agent asked for a note or order.",
  },
  {
    icon: UserRound,
    title: "Human-in-the-loop control",
    copy: "Appeals stay drafts until a healthcare reviewer approves, rejects, or escalates. The agent never silently submits.",
  },
  {
    icon: ClipboardList,
    title: "Shared case state",
    copy: "Patients and healthcare teams see the same claim timeline, documents, and status instead of emailed PDF threads.",
  },
  {
    icon: FolderOpen,
    title: "Document collection that is specific",
    copy: "Patients are asked for the exact clinical artifact still missing — not a generic “please upload records” request.",
  },
  {
    icon: Lock,
    title: "Role-scoped access",
    copy: "Patients only see their claims. Healthcare users only see their organization’s queue. Row-level security enforces the split.",
  },
];

const PATIENT_POINTS = [
  "Create a claim and choose the health provider handling it",
  "Read denial status in plain language",
  "Upload the specific note, order, or imaging still missing",
  "Follow appeal progress without calling the office for an update",
];

const HEALTHCARE_POINTS = [
  "Work a queue of org-assigned cases, not a shared inbox",
  "Inspect the agent trace before anything leaves the building",
  "Approve or escalate appeal drafts with an audit trail",
  "Keep patient uploads and payer policy attached to one record",
];

const SECURITY_POINTS = [
  {
    title: "Append-only audit trail",
    copy: "Case actions record actor, previous state, and next state so reviews are reconstructable.",
  },
  {
    title: "Role-based workspaces",
    copy: "Patient and healthcare dashboards are separate. Authorization follows the profile, not a hidden admin flag.",
  },
  {
    title: "Evaluation harness",
    copy: "A 20-case suite is used to check routing, escalation, and whether the agent abstains when evidence is incomplete.",
  },
  {
    title: "Safety-first routing",
    copy: "Ambiguous or high-risk situations are designed to escalate rather than produce a confident but unsupported appeal.",
  },
];

export function MarketingHome() {
  return (
    <>
      <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles size={12} />
            Auditable AI for prior auth and denials
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-pretty sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
            Recover denied claims with a workflow you can inspect.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            Claimsure AI connects patients and healthcare teams around one case:
            parse the denial, retrieve payer policy, find the evidence gap, and
            verify the appeal. The agent shows its work. People stay in control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="cs-btn cs-btn-primary">
              Start as patient or healthcare <ArrowRight size={16} />
            </Link>
            <Link href="/#how-it-works" className="cs-btn cs-btn-ghost">
              See the 9-node agent
            </Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border/80 pt-6">
            {[
              ["9 nodes", "One state machine"],
              ["2 workspaces", "Patient & healthcare"],
              ["Full trail", "Every decision logged"],
            ].map(([value, label]) => (
              <div key={value}>
                <dt className="text-sm font-semibold">{value}</dt>
                <dd className="mt-1 text-xs leading-5 text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="cs-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">
                Live case pattern
              </p>
              <p className="mt-2 text-lg font-semibold">Nine-node agent</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Parse the denial, retrieve policy, compute the gap, then route
                to action or review.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
              PENDING
            </span>
          </div>
          <ol className="mt-5 space-y-2">
            {NODES.map((node, index) => (
              <li
                key={node.title}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/80 px-3 py-2.5 text-sm"
              >
                <span className="w-6 font-mono text-[11px] text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 font-medium">{node.title}</span>
                {index === 3 ? (
                  <span className="hidden text-[11px] text-accent sm:inline">
                    Current
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="product" className="scroll-mt-24 py-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Product
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Built for the denial, not a chatbot window.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Claimsure AI is a shared operations layer. It keeps policy,
            evidence, and appeal state on the claim so patients are not guessing
            what to upload and reviewers are not reconstructing context from
            email.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="cs-panel rounded-3xl p-6">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/12 text-accent">
                <item.icon size={18} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 py-10">
        <div className="cs-panel rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            How it works
          </p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
            Nine nodes. One case. Nothing hidden in a prompt.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Each claim moves through a fixed sequence. Healthcare reviewers can
            open the trace, see which node ran, and decide what happens next. If
            evidence is incomplete, the agent is expected to stop and ask — not
            fill the gap with speculation.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {NODES.map((node, index) => (
              <article
                key={node.title}
                className="rounded-2xl border border-border bg-surface-2/70 p-4"
              >
                <p className="font-mono text-[11px] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-sm font-semibold">{node.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {node.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="scroll-mt-24 py-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Workspaces
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            One product, two roles, the same claim.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Signup asks which path you need. Permissions, queues, and
            notifications follow that role for the life of the account.
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="cs-panel rounded-3xl p-7">
            <Stethoscope className="text-accent" />
            <h3 className="mt-4 text-2xl font-semibold">Patient workspace</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              For people who received a denial or are waiting on prior
              authorization and need a clear place to act.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm leading-6 text-muted">
              {PATIENT_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2
                    size={16}
                    className="mt-1 shrink-0 text-success"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent"
            >
              Create a patient account <ArrowRight size={14} />
            </Link>
          </article>
          <article className="cs-panel rounded-3xl p-7">
            <Shield className="text-accent-2" />
            <h3 className="mt-4 text-2xl font-semibold">
              Healthcare workspace
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              For organizations that run the agent, review traces, and own
              appeal quality before a packet is submitted.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm leading-6 text-muted">
              {HEALTHCARE_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2
                    size={16}
                    className="mt-1 shrink-0 text-success"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent-2"
            >
              Join as healthcare <ArrowRight size={14} />
            </Link>
          </article>
        </div>
      </section>

      <section id="security" className="scroll-mt-24 py-10">
        <div className="cs-panel rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-2">
            Security & reliability
          </p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
            Designed to show the work, then keep a record of it.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Denial recovery is an operational process. Claimsure AI treats every
            recommendation as something a reviewer should be able to reconstruct
            later — including when the agent chooses not to act.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {SECURITY_POINTS.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-border bg-surface-2/70 p-5"
              >
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cs-panel mb-6 rounded-3xl p-8 text-center sm:p-10">
        <h2 className="text-3xl font-semibold tracking-tight">
          Start with one denied service.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted">
          Create a patient or healthcare account, attach the denial, and let the
          case follow a path you can audit from the first parse to verification.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="cs-btn cs-btn-primary">
            Get started <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="cs-btn cs-btn-ghost">
            Sign in
          </Link>
        </div>
      </section>
    </>
  );
}
