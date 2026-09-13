"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { apiFetch, appFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

export function NotificationBell() {
  const pathname = usePathname();
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
      setItems(data.notifications);
    } catch {
      try {
        const data = await apiFetch<{ notifications: NotificationItem[] }>(
          "/notifications",
        );
        setItems(data.notifications);
      } catch {
        setItems([]);
      }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const unread = items.filter((item) => !item.is_read).length;

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
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
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
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted">
                No notifications yet.
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    className="w-full px-3 py-3 text-left hover:bg-surface-2"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.message}
                    </p>
                    {!item.is_read ? (
                      <p className="mt-1 text-[11px] text-accent">Unread</p>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
