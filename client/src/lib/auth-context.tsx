"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { isUserRole, type Profile } from "@/lib/types";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  async function load() {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const nextUser = data.user ?? null;
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data: row } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, organization_id, created_at")
      .eq("id", nextUser.id)
      .maybeSingle();
    setProfile(row && isUserRole(row.role) ? (row as Profile) : null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    if (!configured) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => data.subscription.unsubscribe();
  }, [configured]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      configured,
      refresh: load,
      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
      },
    }),
    [user, profile, loading, configured],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
