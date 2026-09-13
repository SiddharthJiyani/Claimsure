import { Check } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";

const BENEFITS = [
  {
    title: "Smarter claim processing",
    copy: "AI helps identify missing records and potential issues before they slow down a claim.",
  },
  {
    title: "One connected workflow",
    copy: "Keep claim information, documentation, and next steps organized in one place.",
  },
  {
    title: "Built for healthcare",
    copy: "Designed around the real-world needs of patients and healthcare organizations.",
  },
];

export function ShieldMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 3L19 6V11.5C19 16.2 16.1 19.3 12 21C7.9 19.3 5 16.2 5 11.5V6L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuthBrandPanel() {
  return (
    <section className="relative hidden min-h-0 flex-col overflow-hidden text-white dark:text-accent-ink lg:flex">
      <div className="absolute inset-0 bg-accent" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/20 blur-3xl dark:bg-white/15" />
      <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-black/10 blur-3xl dark:bg-white/10" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col justify-center px-12 py-10 xl:px-16">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-accent-ink shadow-lg">
            <ShieldMark />
          </span>
          <span className="text-xl font-bold">
            Claimsure <span className="font-medium">AI</span>
          </span>
        </div>

        <p className="mt-10 inline-flex w-fit rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm dark:border-accent-ink/15 dark:bg-white/25">
          AI-powered insurance claims intelligence
        </p>
        <h1 className="mt-5 text-3xl font-bold leading-[1.15] text-pretty xl:text-4xl">
          Make insurance claims simpler, faster, and smarter.
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/80 xl:text-base dark:text-accent-ink/75">
          Claimsure AI connects patients and healthcare providers with
          intelligent claims workflows, helping identify missing information,
          streamline documentation, and move claims forward.
        </p>
        <ul className="mt-8 grid gap-4">
          {BENEFITS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 dark:bg-white/30">
                <Check size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-white/70 dark:text-accent-ink/70">
                  {item.copy}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="shrink-0">
        <MarketingNav />
      </div>
      <main className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        <AuthBrandPanel />
        <section className="flex min-h-0 overflow-y-auto bg-background px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="mx-auto flex w-full max-w-lg flex-col justify-center">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

export const authFieldClass =
  "mt-1.5 w-full rounded-full border border-border bg-surface px-4 py-2.5 text-foreground outline-none placeholder:text-placeholder focus:border-accent";

export const authRoleCardClass =
  "flex h-full min-h-[200px] flex-col rounded-2xl border border-border bg-surface p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-2";

export const authPrimaryButtonClass =
  "w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55";
