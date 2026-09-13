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
    <section className="relative hidden min-h-0 overflow-hidden text-[#04201c] lg:flex">
      <div className="absolute inset-0 bg-[#2dd4bf]" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col px-10 py-8 xl:px-14">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-lg">
            <ShieldMark />
          </span>
          <span className="text-xl font-bold">
            Claimsure <span className="font-medium">AI</span>
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
          <p className="inline-flex w-fit rounded-full border border-[#04201c]/15 bg-white/25 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm">
            AI-powered insurance claims intelligence
          </p>
          <h1 className="mt-5 text-3xl font-bold leading-[1.15] xl:text-4xl">
            Make insurance claims simpler, faster, and smarter.
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#04201c]/75 xl:text-base">
            Claimsure AI connects patients and healthcare providers with
            intelligent claims workflows, helping identify missing information,
            streamline documentation, and move claims forward.
          </p>
          <ul className="mt-6 grid gap-4">
            {BENEFITS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/30">
                  <Check size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#04201c]/70">
                    {item.copy}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* <div className="flex items-center justify-between text-xs text-[#04201c]/55">
          <span>© {new Date().getFullYear()} Claimsure AI</span>
          <span className="hidden xl:block">Insurance claims, reimagined.</span>
        </div> */}
      </div>
    </section>
  );
}

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[#070b12] text-[#f3f6fb]">
      <div className="shrink-0">
        <MarketingNav />
      </div>
      <main className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        <AuthBrandPanel />
        <section className="flex min-h-0 overflow-hidden px-6 py-6 sm:px-8 lg:px-12">
          <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

export const authFieldClass =
  "mt-1.5 w-full rounded-full border border-[#243247] bg-[#0e1522] px-4 py-2.5 outline-none placeholder:text-[#7f93ab] focus:border-[#2dd4bf]";
