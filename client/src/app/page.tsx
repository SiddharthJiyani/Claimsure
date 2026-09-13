import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldPlus, Stethoscope } from "lucide-react";
import { getProfile, getSessionUser } from "@/lib/auth";
import { roleHome } from "@/lib/types";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    const profile = await getProfile();
    if (profile) redirect(roleHome(profile.role));
    redirect("/complete-profile");
  }

  return (
    <div className="auth-grid min-h-full">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-accent">
          AI prior authorization & denial recovery
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Claimsure connects patients and healthcare teams around one auditable
          claim agent.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Sign up as a patient to track denials and upload missing evidence, or
          as healthcare staff to run the 9-node agent, review citations, and
          approve appeals.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium"
          >
            Sign in
          </Link>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <Stethoscope className="text-accent" />
            <h2 className="mt-4 text-lg font-semibold">Patient</h2>
            <p className="mt-2 text-sm text-muted">
              Personal claims only. See denial explanations in plain language,
              upload the missing clinical note, and watch status move from
              pending to resolved.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6">
            <ShieldPlus className="text-accent-2" />
            <h2 className="mt-4 text-lg font-semibold">Healthcare</h2>
            <p className="mt-2 text-sm text-muted">
              Organization-scoped operations. Trigger analysis, inspect agent
              traces and policy citations, approve or escalate appeals, and open
              the 20-case eval harness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
