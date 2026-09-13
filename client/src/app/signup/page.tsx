"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import { AuthSplit, ShieldMark, authFieldClass } from "@/components/AuthSplit";
import { GoogleButton } from "@/components/GoogleButton";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { rememberPendingRole } from "@/lib/pending-role";
import { roleHome, type UserRole } from "@/lib/types";

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
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2dd4bf] text-[#04201c]">
          <ShieldMark />
        </span>
        <span className="text-lg font-bold">Claimsure AI</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2dd4bf]">
          Get started
        </p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
          {role ? "Create your account" : "Choose your path"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#9aabc2]">
          {role
            ? `Continue as ${
                role === "patient" ? "Patient" : "Healthcare"
              }. Your workspace and permissions follow this role.`
            : "Select Patient or Healthcare to get started with Claimsure AI."}
        </p>
      </div>

      {!role ? (
        <>
          <div className="grid min-h-0 flex-1 content-center gap-3 py-6 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseRole("patient")}
              className="flex h-full flex-col rounded-2xl border border-[#243247] bg-[#0e1522] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2dd4bf]/60 hover:bg-[#111b2b]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2dd4bf]/12 text-[#2dd4bf]">
                <UserRound size={18} />
              </span>
              <p className="mt-auto pt-5 text-sm font-semibold">Patient</p>
              <p className="mt-1.5 text-xs leading-5 text-[#9aabc2]">
                Track claims and upload missing records.
              </p>
            </button>

            <button
              type="button"
              onClick={() => chooseRole("insurance_provider")}
              className="flex h-full flex-col rounded-2xl border border-[#243247] bg-[#0e1522] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2dd4bf]/60 hover:bg-[#111b2b]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2dd4bf]/12 text-[#2dd4bf]">
                <Building2 size={18} />
              </span>
              <p className="mt-auto pt-5 text-sm font-semibold">Healthcare</p>
              <p className="mt-1.5 text-xs leading-5 text-[#9aabc2]">
                Run the agent and manage claim workflows.
              </p>
            </button>
          </div>

          <p className="text-center text-sm text-[#9aabc2]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#2dd4bf] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#9aabc2] transition hover:text-white"
          >
            <ArrowLeft size={14} />
            Change role
          </button>

          {!configured ? (
            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              Add your Supabase credentials to{" "}
              <span className="font-mono">client/.env.local</span>.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
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
              <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !configured}
              className="w-full rounded-full bg-[#2dd4bf] px-5 py-2.5 text-sm font-semibold text-[#04201c] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "Creating account…" : "Create Claimsure AI account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-[#9aabc2]">
            <span className="h-px flex-1 bg-[#243247]" />
            OR
            <span className="h-px flex-1 bg-[#243247]" />
          </div>

          <GoogleButton
            label={`Continue with Google as ${
              role === "patient" ? "Patient" : "Healthcare"
            }`}
            onClick={() => void onGoogle()}
            disabled={!configured}
          />

          <p className="mt-auto pt-4 text-center text-sm text-[#9aabc2]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#2dd4bf] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      )}
    </AuthSplit>
  );
}
