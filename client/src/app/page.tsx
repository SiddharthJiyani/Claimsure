import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { getProfile, getSessionUser } from "@/lib/auth";
import { roleHome } from "@/lib/types";

const NODES = [
  "Parse denial",
  "Retrieve policy",
  "Scan evidence",
  "Compute gap",
  "Route",
  "Act",
  "Human review",
  "Assemble appeal",
  "Verify",
];

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    const profile = await getProfile();
    if (profile) redirect(roleHome(profile.role));
    redirect("/complete-profile");
  }

  return (
    <div className="auth-grid min-h-full">
      <MarketingNav />
      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles size={12} />
              Multi-step AI agent for denials
            </p>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-tight md:text-6xl">
              Recover denied claims with an auditable AI agent.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              Claimsure connects patients and healthcare teams around one
              prior-authorization workflow: parse the denial, retrieve policy,
              find the evidence gap, and verify the appeal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="cs-btn cs-btn-primary">
                Start as patient or healthcare <ArrowRight size={16} />
              </Link>
              <Link href="/#how-it-works" className="cs-btn cs-btn-ghost">
                See the 9-node agent
              </Link>
            </div>
          </div>
          <div className="cs-panel rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Denial recovery workflow
            </p>
            <p className="mt-2 text-lg font-semibold">Nine-node agent</p>
            <p className="text-sm text-muted">
              Parse → retrieve policy → scan evidence → decide
            </p>
            <ol className="mt-5 space-y-2">
              {NODES.map((node, index) => (
                <li
                  key={node}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 px-3">{node}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="product" className="grid gap-4 py-10 md:grid-cols-3">
          {[
            [
              "Deterministic gaps",
              "Evidence missing vs found is a set difference, not a guess.",
            ],
            [
              "Human-in-the-loop",
              "Healthcare reviewers approve, reject, or escalate appeal drafts.",
            ],
            [
              "Citation-backed",
              "Every recommendation points at a payer clause the agent retrieved.",
            ],
          ].map(([title, copy]) => (
            <div key={title} className="cs-panel rounded-3xl p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="cs-panel mt-8 rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-accent">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Nine nodes. One case state machine.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            The agent parses the denial, retrieves payer policy, scans evidence,
            computes the gap, then routes to act, human review, or abstain.
            Verification closes the loop.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {NODES.map((node) => (
              <div
                key={node}
                className="rounded-2xl border border-border bg-background/50 px-4 py-3 text-sm"
              >
                {node}
              </div>
            ))}
          </div>
        </section>

        <section id="roles" className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="cs-panel rounded-3xl p-7">
            <Stethoscope className="text-accent" />
            <h2 className="mt-4 text-2xl font-semibold">Patient workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Track your claims, read denials in plain language, and upload the
              missing clinical note.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex items-center gap-2 text-sm text-accent"
            >
              Create a patient account <ArrowRight size={14} />
            </Link>
          </div>
          <div className="cs-panel rounded-3xl p-7">
            <Shield className="text-accent-2" />
            <h2 className="mt-4 text-2xl font-semibold">
              Healthcare workspace
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Run the agent on org-assigned cases, review traces, and approve
              appeals from one queue.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex items-center gap-2 text-sm text-accent-2"
            >
              Join as healthcare <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section id="reliability" className="cs-panel mt-12 rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-accent-2">
            Reliability
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Built to show the work.
          </h2>
          <ul className="mt-5 grid gap-3 text-sm text-muted md:grid-cols-2">
            {[
              "20-case evaluation harness",
              "100% safety escalation target",
              "Append-only audit trail",
              "Role-based dashboards + RLS",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
