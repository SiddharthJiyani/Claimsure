"use client";

import Link from "next/link";
import { Bell, Mail, Send, CheckCircle2 } from "lucide-react";
import { apiFetch, appFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { notificationCaseHref } from "@/lib/notification-href";
import { useNotifications } from "@/lib/use-workspace-data";
import { useAuth } from "@/lib/auth-context";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { QueueSkeleton } from "@/components/StatCard";
import { relativeTime } from "@/lib/format";

export function NotificationList() {
  const { profile } = useAuth();
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
        description="Claim determinations, appeal notices, and AI agent completion alerts will appear here."
      />
    );
  }

  return (
    <ul className="cs-panel divide-y divide-border overflow-hidden rounded-2xl">
      {items.map((item) => {
        const isEmail = item.channel === "email";
        const isInsurer = profile?.role === "insurance_provider";
        const recipientLabel = isInsurer ? "To: Insurance Provider" : "To: Patient";

        return (
          <li key={item.id} className="px-5 py-4 transition hover:bg-surface-2/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {!item.is_read ? (
                    <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
                  ) : null}

                  {/* Recipient Badge */}
                  <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border">
                    <Send size={10} className="text-accent" />
                    {recipientLabel}
                  </span>

                  {/* Channel Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      isEmail
                        ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        : "bg-accent/10 text-accent border border-accent/20"
                    }`}
                  >
                    {isEmail ? <Mail size={10} /> : <Bell size={10} />}
                    {isEmail ? "Email (Nodemailer SMTP)" : "In-App"}
                  </span>

                  {/* Event Type */}
                  <span className="text-[10px] text-muted uppercase tracking-wider font-mono">
                    {item.type.replace(/_/g, " ")}
                  </span>
                </div>

                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{item.message}</p>
                <p className="mt-2 text-xs text-muted font-mono">{relativeTime(item.created_at)}</p>
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
