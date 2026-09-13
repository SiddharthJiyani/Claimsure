import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { aiServerUrl } from "@/lib/env";
import { dashboardForExactCases, toEvalDashboard } from "@/lib/eval-results";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimCase } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "insurance_provider") {
    return NextResponse.json(
      { error: "Evaluation results are only available to healthcare" },
      { status: 403 },
    );
  }

  const harness = (await readRemoteResults()) ?? (await readLocalResults());
  const claims = await loadExactCases(profile.organization_id);
  if (claims.length) {
    return NextResponse.json(dashboardForExactCases(claims, harness));
  }
  if (harness) return NextResponse.json(harness);

  return NextResponse.json(
    { error: "Eval results are not available yet" },
    { status: 404 },
  );
}

async function loadExactCases(organizationId: string | null) {
  if (!organizationId) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("cases")
    .select(
      "*, documents(id, name, document_type, is_missing, created_at), agent_state(state_data, updated_at)",
    )
    .eq("insurer_org_id", organizationId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as ClaimCase[];
}

async function readRemoteResults() {
  try {
    const response = await fetch(`${aiServerUrl()}/api/eval/results`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const dashboard = toEvalDashboard(await response.json());
    return dashboard.metrics.length ? dashboard : null;
  } catch {
    return null;
  }
}

async function readLocalResults() {
  const candidates = [
    path.join(process.cwd(), "..", "ai-server", "eval", "results.json"),
    path.join(process.cwd(), "ai-server", "eval", "results.json"),
  ];
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf8");
      if (raw.includes("<<<<<<<")) continue;
      const dashboard = toEvalDashboard(JSON.parse(raw));
      if (dashboard.metrics.length) return dashboard;
    } catch {
      // try next path
    }
  }
  return null;
}
