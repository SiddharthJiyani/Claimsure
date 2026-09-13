"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import {
  AuthSplit,
  ShieldMark,
  authFieldClass,
  authPrimaryButtonClass,
  authRoleCardClass,
} from "@/components/AuthSplit";
import { GoogleButton } from "@/components/GoogleButton";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, siteUrl, apiUrl } from "@/lib/env";
import { rememberPendingRole } from "@/lib/pending-role";
import { type UserRole } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  function chooseRole(next: UserRole) {
    setRole(next);
    setError(null);
    setMessage(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!role) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      rememberPendingRole(role, organizationName);
      // Call the Express backend /auth/signup API
      const payload: Record<string, string> = {
        email,
        password,
        full_name: fullName,
        role,
      };
      if (role === "insurance_provider" && organizationName) {
        payload["organization_name"] = organizationName;
      }
      const res = await fetch(`${apiUrl()}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json() as { success: boolean; error?: { code?: string; message?: string } | string };
      if (!res.ok || !body.success) {
        const errMsg = typeof body.error === 'string'
          ? body.error
          : body.error?.message ?? "Sign up failed";
        throw new Error(errMsg);
      }
      setMessage("Account created! Sign in to continue.");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (!role) return;
    setError(null);
    rememberPendingRole(role, organizationName);
    const params = new URLSearchParams({ role });
    if (role === "insurance_provider" && organizationName) {
      params.set("organization_name", organizationName);
    }
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl()}/auth/callback?${params.toString()}`,
        scopes: "email profile",
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <AuthSplit>
      <div className="mb-5 flex items-center gap-3 lg:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink">
          <ShieldMark />
        </span>
        <span className="text-lg font-bold">Claimsure AI</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Get started
        </p>
        <h2 className="mt-2 text-2xl font-bold text-pretty sm:text-3xl">
          {role ? "Create your account" : "Choose your path"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {role
            ? `Continue as ${
                role === "patient" ? "Patient" : "Healthcare"
              }. Your workspace and permissions follow this role.`
            : "Select Patient or Healthcare to get started with Claimsure AI."}
        </p>
      </div>

      {!role ? (
        <>
          <div className="mt-8 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseRole("patient")}
              className={authRoleCardClass}
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">
                <UserRound size={20} />
              </span>
              <p className="mt-6 text-base font-semibold">Patient</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Track claims and upload missing records.
              </p>
            </button>

            <button
              type="button"
              onClick={() => chooseRole("insurance_provider")}
              className={authRoleCardClass}
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent">
                <Building2 size={20} />
              </span>
              <p className="mt-6 text-base font-semibold">Healthcare</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Run the agent and manage claim workflows.
              </p>
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Change role
          </button>

          {!configured ? (
            <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
              Add your Supabase credentials to{" "}
              <span className="font-mono">client/.env.local</span>.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            <div
              className={
                role === "insurance_provider"
                  ? "grid gap-3 sm:grid-cols-2"
                  : "grid gap-3"
              }
            >
              <label className="block text-sm font-medium">
                Full name
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="John Doe"
                  className={authFieldClass}
                />
              </label>

              {role === "insurance_provider" ? (
                <label className="block text-sm font-medium">
                  Organization
                  <input
                    required
                    value={organizationName}
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                    placeholder="Aetna Health"
                    className={authFieldClass}
                  />
                </label>
              ) : null}
            </div>

            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={authFieldClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={authFieldClass}
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !configured}
              className={authPrimaryButtonClass}
            >
              {busy ? "Creating account…" : "Create Claimsure AI account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton
            label={`Continue with Google as ${
              role === "patient" ? "Patient" : "Healthcare"
            }`}
            onClick={() => void onGoogle()}
            disabled={!configured}
          />

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthSplit>
  );
}
