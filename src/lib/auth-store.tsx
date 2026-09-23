"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

/**
 * Auth state for the UI (Phase 6): the current Supabase user, a loading flag
 * for the brief moment before the session is read, and signOut.
 *
 * Route protection itself lives in the server middleware — this context only
 * feeds the UI (user email, initials, logout button). Session persistence is
 * handled entirely by Supabase Auth through cookies.
 */

interface AuthState {
  user: User | null;
  /** True until the first session read completes. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Starts false when Supabase isn't configured (nothing to wait for), true
  // otherwise until the first session read completes.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();

    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!active) return;
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await getSupabaseClient().auth.signOut();
    // A full navigation clears every in-memory store (business, products,
    // customers, invoices) so the next login starts fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
