"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthSplit,
  ShieldMark,
  authFieldClass,
  authPrimaryButtonClass,
} from "@/components/AuthSplit";
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
    <AuthSplit>
      <div className="mb-5 flex items-center gap-3 lg:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-ink">
          <ShieldMark />
        </span>
        <span className="text-lg font-bold">Claimsure AI</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Welcome back
        </p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Sign in</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          One door for patients and healthcare teams. Your role opens the right
          workspace.
        </p>
      </div>

      <div className="mt-8">
        {!configured ? (
          <p className="mb-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            Add your Supabase keys to{" "}
            <span className="font-mono">client/.env.local</span>.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-3">
          <label className="block text-sm font-medium">
            Email
            <input
              className={authFieldClass}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className={authFieldClass}
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
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
          {error ? (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !configured}
            className={authPrimaryButtonClass}
          >
            {busy ? "Signing in…" : "Sign in with email"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleButton
          label="Continue with Google"
          onClick={() => void onGoogle()}
          disabled={!configured}
        />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthSplit>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
