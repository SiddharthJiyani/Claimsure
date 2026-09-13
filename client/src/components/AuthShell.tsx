import { MarketingNav } from "@/components/MarketingNav";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-grid min-h-full">
      <MarketingNav />
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10">
        <div className="cs-panel w-full max-w-lg rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-accent">
            Claimsure
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
