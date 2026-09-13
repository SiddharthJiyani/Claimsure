import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorCallout({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/25 bg-warn/8 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Could not refresh this view
          </p>
          <p className="mt-0.5 text-sm text-muted">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="cs-btn cs-btn-ghost">
          <RefreshCw size={14} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
