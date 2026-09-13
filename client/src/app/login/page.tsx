"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { isUserRole, roleHome } from "@/lib/types";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user?.id ?? "")
        .maybeSingle();
      if (!profile || !isUserRole(profile.role)) {
        router.push("/");
        router.refresh();
        return;
      }
      router.push(next.startsWith("/") ? next : roleHome(profile.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl()}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        scopes: "email profile",
      },
    });
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="auth-grid grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8">
        <p className="text-sm text-accent">Claimsure</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Patients and healthcare teams use the same door — your role routes the
          rest.
        </p>

        {!configured ? (
          <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            Add your Supabase URL and anon/publishable key to{" "}
            <span className="font-mono">client/.env.local</span>.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-muted hover:text-accent"
            >
              Forgot password?
            </Link>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in with email"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton
          label="Continue with Google"
          onClick={() => void onGoogle()}
          disabled={!configured}
        />

        <p className="mt-6 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
