import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-grid min-h-full">
      <MarketingNav />
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <div className="cs-panel w-full max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-semibold">
            Sign-in could not be completed
          </h1>
          <p className="mt-2 text-sm text-muted">
            Confirm{" "}
            <span className="font-mono">
              http://localhost:3000/auth/callback
            </span>{" "}
            is allowed in Supabase Auth.
          </p>
          <Link href="/login" className="cs-btn cs-btn-primary mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
