import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  hints,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  hints?: string[];
}) {
  return (
    <div className="cs-panel rounded-2xl px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface-2 text-accent">
        <Icon size={20} />
      </span>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {description}
      </p>
      {hints?.length ? (
        <ul className="mx-auto mt-5 max-w-md space-y-1.5 text-left text-sm text-muted">
          {hints.map((hint) => (
            <li key={hint} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{hint}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
