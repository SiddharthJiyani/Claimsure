"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { GoogleButton } from "@/components/GoogleButton";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { rememberPendingRole } from "@/lib/pending-role";
import { roleHome, type UserRole } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("patient");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      rememberPendingRole(role, organizationName);
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl()}/auth/callback?role=${role}`,
          data: {
            full_name: fullName,
            role,
            organization_name:
              role === "insurance_provider" ? organizationName : "",
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        setMessage("Check your email to confirm the account, then sign in.");
        return;
      }
      router.push(roleHome(role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
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
    <AuthShell
      title="Create an account"
      subtitle="Choose a role first. That choice locks your dashboard and permissions."
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRole("patient")}
          className={`rounded-2xl border px-4 py-3 text-left ${
            role === "patient"
              ? "border-accent bg-accent/10"
              : "border-border bg-background"
          }`}
        >
          <p className="text-sm font-semibold">Patient</p>
          <p className="mt-1 text-xs text-muted">
            Track claims and upload missing records.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setRole("insurance_provider")}
          className={`rounded-2xl border px-4 py-3 text-left ${
            role === "insurance_provider"
              ? "border-accent bg-accent/10"
              : "border-border bg-background"
          }`}
        >
          <p className="text-sm font-semibold">Healthcare</p>
          <p className="mt-1 text-xs text-muted">
            Run the agent and approve appeals.
          </p>
        </button>
      </div>

      {!configured ? (
        <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          Add your Supabase credentials to{" "}
          <span className="font-mono">client/.env.local</span>.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block text-sm">
          Full name
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="cs-input mt-1"
          />
        </label>
        {role === "insurance_provider" ? (
          <label className="block text-sm">
            Organization
            <input
              required
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Aetna Health"
              className="cs-input mt-1"
            />
          </label>
        ) : null}
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="cs-input mt-1"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="cs-input mt-1"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        <button
          type="submit"
          disabled={busy || !configured}
          className="cs-btn cs-btn-primary w-full"
        >
          {busy ? "Creating account…" : "Sign up with email"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton
        label={`Continue with Google as ${role === "patient" ? "Patient" : "Healthcare"}`}
        onClick={() => void onGoogle()}
        disabled={!configured}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
