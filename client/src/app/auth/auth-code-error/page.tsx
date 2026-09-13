import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-grid grid min-h-full place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">
          Sign-in could not be completed
        </h1>
        <p className="mt-2 text-sm text-muted">
          The Google or email confirmation link failed. Confirm the redirect URL
          <span className="font-mono">
            {" "}
            http://localhost:3000/auth/callback{" "}
          </span>
          is allowed in Supabase Auth.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
