import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="cs-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function QueueSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="cs-panel overflow-hidden rounded-2xl">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse border-t border-border/70 first:border-t-0"
          style={{ opacity: 1 - index * 0.12 }}
        />
      ))}
    </div>
  );
}
