"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { apiFetch, appFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { notificationCaseHref } from "@/lib/notification-href";
import type { NotificationItem } from "@/lib/types";

function asNotificationList(payload: {
  notifications?: NotificationItem[] | null;
  data?: NotificationItem[] | null;
} | null) {
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function NotificationBell() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const inboxHref = pathname.startsWith("/insurance")
    ? "/insurance/notifications"
    : "/patient/notifications";
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  async function load() {
    try {
      const data = await appFetch<{ notifications: NotificationItem[] }>(
        "/api/workspace/notifications",
      );
      setItems(asNotificationList(data));
    } catch {
      try {
        const data = await apiFetch<{
          notifications?: NotificationItem[];
          data?: NotificationItem[];
        }>("/notifications");
        setItems(asNotificationList(data));
      } catch {
        setItems([]);
      }
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 12000);
    return () => window.clearInterval(timer);
  }, []);

  const list = Array.isArray(items) ? items : [];
  const unread = list.filter((item) => !item.is_read).length;

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        className="relative rounded-xl border border-border bg-surface-2 p-2 text-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-[color:var(--cs-on-danger)]">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="cs-popover absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
            Alerts
            <Link
              href={inboxHref}
              className="text-xs text-accent"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          <ul className="max-h-80 overflow-auto">
            {list.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted">
                No notifications yet.
              </li>
            ) : (
              list.map((item) => {
                const href = notificationCaseHref(profile?.role, item.case_id);
                const inner = (
                  <>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.message}
                    </p>
                    {!item.is_read ? (
                      <p className="mt-1 text-[11px] text-accent">Unread</p>
                    ) : null}
                  </>
                );
                return (
                  <li key={item.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          setOpen(false);
                          if (!item.is_read) void markRead(item.id);
                        }}
                        className="block w-full px-3 py-3 text-left hover:bg-surface-2"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void markRead(item.id)}
                        className="w-full px-3 py-3 text-left hover:bg-surface-2"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
