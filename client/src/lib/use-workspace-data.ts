"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, appFetch } from "@/lib/api";
import type { ClaimCase, NotificationItem } from "@/lib/types";

export function useCases() {
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await appFetch<{ cases: ClaimCase[] }>(
        "/api/workspace/cases",
      );
      setCases(data.cases);
      setError(null);
    } catch {
      try {
        const data = await apiFetch<{ cases: ClaimCase[] }>("/cases");
        setCases(data.cases);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load cases");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { cases, error, loading, reload, setError };
}

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await appFetch<{ notifications: NotificationItem[] }>(
        "/api/workspace/notifications",
      );
      setItems(data.notifications);
      setError(null);
    } catch {
      try {
        const data = await apiFetch<{ notifications: NotificationItem[] }>(
          "/notifications",
        );
        setItems(data.notifications);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load notifications",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, error, loading, reload, setItems };
}
