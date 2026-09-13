"use client";

import { Bell } from "lucide-react";
import { apiFetch, appFetch } from "@/lib/api";
import { useNotifications } from "@/lib/use-workspace-data";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { QueueSkeleton } from "@/components/StatCard";
import { relativeTime } from "@/lib/format";

export function NotificationList() {
  const { items, error, loading, reload, setItems } = useNotifications();

  async function markRead(id: string) {
    try {
      await appFetch(`/api/workspace/notifications/${id}`, { method: "PATCH" });
    } catch {
      try {
        await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      } catch {
        return;
      }
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, is_read: true } : item,
      ),
    );
  }

  if (loading) return <QueueSkeleton rows={3} />;
  if (error)
    return <ErrorCallout message={error} onRetry={() => void reload()} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Inbox is clear"
        description="Approval requests, missing-document asks, and agent completions will appear here."
      />
    );
  }

  return (
    <ul className="cs-panel divide-y divide-border overflow-hidden rounded-2xl">
      {items.map((item) => (
        <li key={item.id} className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!item.is_read ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
                <p className="text-sm font-semibold">{item.title}</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                {item.message}
              </p>
              <p className="mt-2 text-xs text-muted">
                {relativeTime(item.created_at)}
              </p>
            </div>
            {!item.is_read ? (
              <button
                type="button"
                onClick={() => void markRead(item.id)}
                className="shrink-0 text-xs text-accent"
              >
                Mark read
              </button>
            ) : (
              <span className="shrink-0 text-xs text-muted">Read</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
