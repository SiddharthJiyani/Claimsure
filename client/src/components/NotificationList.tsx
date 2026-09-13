"use client";

import { apiFetch } from "@/lib/api";
import { useNotifications } from "@/lib/use-workspace-data";
import { EmptyState } from "@/components/EmptyState";

export function NotificationList() {
  const { items, error, setItems } = useNotifications();

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item,
        ),
      );
    } catch {
      // Keep the list usable if the API is offline.
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No alerts yet"
        description="Case updates, missing-document requests, and approval asks will land here."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="cs-panel rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
              <p className="mt-2 text-xs text-muted">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
            {!item.is_read ? (
              <button
                type="button"
                onClick={() => void markRead(item.id)}
                className="text-xs text-accent"
              >
                Mark read
              </button>
            ) : (
              <span className="text-xs text-muted">Read</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
