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
      const data = await appFetch<{ cases?: ClaimCase[]; data?: ClaimCase[] }>(
        "/api/workspace/cases",
      );
      const list = Array.isArray(data?.cases)
        ? data.cases
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setCases(list);
      setError(null);
    } catch {
      try {
        const data = await apiFetch<{ cases?: ClaimCase[]; data?: ClaimCase[] }>("/cases");
        const list = Array.isArray(data?.cases)
          ? data.cases
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setCases(list);
        setError(null);
      } catch (err) {
        setCases([]);
        setError(err instanceof Error ? err.message : "Could not load cases");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { cases: cases ?? [], error, loading, reload, setError };
}

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await appFetch<{ notifications?: NotificationItem[]; data?: NotificationItem[] }>(
        "/api/workspace/notifications",
      );
      const list = Array.isArray(data?.notifications)
        ? data.notifications
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setItems(list);
      setError(null);
    } catch {
      try {
        const data = await apiFetch<{ notifications?: NotificationItem[]; data?: NotificationItem[] }>(
          "/notifications",
        );
        const list = Array.isArray(data?.notifications)
          ? data.notifications
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setItems(list);
        setError(null);
      } catch (err) {
        setItems([]);
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

  return { items: items ?? [], error, loading, reload, setItems };
}
