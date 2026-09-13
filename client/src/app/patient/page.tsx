"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FolderOpen } from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { StatCard } from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ClaimCase } from "@/lib/types";

export default function PatientDashboardPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [serviceType, setServiceType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ cases: ClaimCase[] }>("/cases");
      setCases(data.cases);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load claims");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    return {
      open: cases.filter(
        (claim) => !["RESOLVED", "CLOSED"].includes(claim.status),
      ).length,
      action: cases.filter((claim) => claim.status === "ACTION_REQUIRED")
        .length,
      resolved: cases.filter((claim) => claim.status === "RESOLVED").length,
    };
  }, [cases]);

  async function seedDemo() {
    setBusy(true);
    try {
      await apiFetch("/demo/seed", { method: "POST" });
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load demo cases",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/cases", {
        method: "POST",
        body: JSON.stringify({ service_type: serviceType }),
      });
      setServiceType("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-accent">Patient portal</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Hello {profile?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your claims, missing documents, and status updates live here.
          Healthcare staff on the other side see the same case with agent tools
          you do not.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Open claims" value={stats.open} icon={FolderOpen} />
        <StatCard
          label="Needs your action"
          value={stats.action}
          hint="Usually a missing clinical record"
          icon={AlertTriangle}
        />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Start a claim</h2>
            <p className="text-sm text-muted">
              Describe the denied or pending service. You can attach evidence on
              the case page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void seedDemo()}
            disabled={busy}
            className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
          >
            Load demo cases
          </button>
        </div>
        <form
          onSubmit={createCase}
          className="mt-4 flex flex-col gap-3 md:flex-row"
        >
          <input
            required
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            placeholder="e.g. MRI Lumbar Spine"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            Submit claim
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock3 size={16} className="text-muted" />
          <h2 className="text-lg font-semibold">My claims</h2>
        </div>
        {cases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted">
            No claims yet. Submit one above or load the demo set to explore the
            full flow.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cases.map((claim) => (
              <CaseCard
                key={claim.id}
                claim={claim}
                href={`/patient/cases/${claim.id}`}
                subtitle="Your claim"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
