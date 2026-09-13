"use client";

import { useEffect, useState } from "react";
import { UploadCloud, BookOpen, CheckCircle2, AlertCircle, FileText, Loader2, RefreshCw } from "lucide-react";
import { aiServerUrl } from "@/lib/env";

interface PolicySummary {
  policy_id: string;
  payer_id: string;
  section_title: string;
  clause_count: number;
  service_codes: string[];
}

export function InsurerPolicyManager() {
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchPolicies() {
    setLoading(true);
    try {
      const res = await fetch(`${aiServerUrl()}/api/policies`);
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch {
      // AI server may be loading
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPolicies();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a policy document (PDF, Markdown, or Text).");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const form = new FormData();
      form.set("file", file);
      if (policyName.trim()) {
        form.set("payer_id", policyName.trim().toLowerCase().replace(/\s+/g, "_"));
        form.set("org_name", policyName.trim());
      }

      const res = await fetch(`${aiServerUrl()}/api/policies/upload`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload and index policy document");
      }

      setSuccess(
        `Policy successfully uploaded! ${data.clauses_indexed || 0} clauses chunked, embedded, and added to the RAG knowledge base.`
      );
      setFile(null);
      setPolicyName("");
      await fetchPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error uploading policy");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="cs-panel rounded-2xl p-6 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="cs-kicker text-accent">Payer Policy Corpus (RAG)</span>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Insurance Provider Coverage Policies
          </h2>
          <p className="mt-1 text-xs text-muted">
            Upload your organization's clinical policies. The 9-node AI agent retrieves and checks claims strictly against these clauses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchPolicies()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-foreground transition"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Upload new policy form */}
      <form onSubmit={(e) => void handleUpload(e)} className="mt-5 rounded-xl border border-dashed border-border bg-surface-2/40 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">
          Upload New Policy Document (PDF, Markdown, or TXT)
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted">
              Policy / Organization Label
            </label>
            <input
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="e.g. Aetna Lumbar Spine CPB-0236"
              className="cs-input mt-1 w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted">
              Select Policy File
            </label>
            <input
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:opacity-90"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-400">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-400">
            <CheckCircle2 size={14} />
            <span>{success}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={uploading || !file}
            className="cs-btn cs-btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-4"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Parsing, chunking & embedding…
              </>
            ) : (
              <>
                <UploadCloud size={14} />
                Ingest into RAG Corpus
              </>
            )}
          </button>
        </div>
      </form>

      {/* List of active policies */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          Active Policies in Knowledge Base ({policies.length})
        </h3>

        {policies.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">
            No policies indexed yet. Upload a policy document to enable RAG verification.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {policies.map((p) => (
              <div
                key={p.policy_id}
                className="rounded-xl border border-border bg-surface-2/60 p-3.5 text-xs transition hover:border-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <BookOpen size={14} className="text-accent shrink-0" />
                    <span className="truncate">{p.section_title || p.policy_id}</span>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent shrink-0">
                    {p.clause_count} clauses
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>Payer: <strong>{p.payer_id}</strong></span>
                  {p.service_codes.length > 0 && (
                    <span>• Codes: {p.service_codes.join(", ")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
