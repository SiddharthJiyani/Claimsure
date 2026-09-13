"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/env";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${siteUrl()}/auth/callback?next=/login`,
      },
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("If that email exists, a reset link is on the way.");
  }

  return (
    <div className="auth-grid grid min-h-full place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-surface p-8"
      >
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-background px-3 py-2"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background"
        >
          Send reset link
        </button>
        <Link
          href="/login"
          className="block text-center text-sm text-muted hover:text-accent"
        >
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
