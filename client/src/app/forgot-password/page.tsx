"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
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
    <AuthShell
      title="Reset password"
      subtitle="We’ll email a recovery link if the account exists."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="cs-input"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        <button type="submit" className="cs-btn cs-btn-primary w-full">
          Send reset link
        </button>
        <Link
          href="/login"
          className="block text-center text-sm text-muted hover:text-accent"
        >
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
