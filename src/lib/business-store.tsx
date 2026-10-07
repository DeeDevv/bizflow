"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { BusinessInfo } from "./types";
import { createPersistentStore } from "./persistent-store";
import { loadBusiness } from "./business-db";

/**
 * Business settings store — the "enter it once, reuse it everywhere" hub.
 * The business name, logo, phone/WhatsApp, address, currency saved here
 * flow automatically onto invoices, receipts, and sale records.
 *
 * A brand-new signup has NO business yet: the store starts clean (empty
 * strings, no seed values) and `status` says "setup" until the owner saves
 * the Business Setup form — no phantom business, no default USD.
 */

/**
 * Phase 8.6→bizmate migration: the app-branded localStorage cache key is now
 * bizmate.business.v1. bizflow.business.v1 is read once as a fallback so
 * existing devices keep working; the bizflow key is never written again.
 */
const STORAGE_KEY = "bizmate.business.v1";
const LEGACY_STORAGE_KEY = "bizflow.business.v1";

/** Clean slate for a first-time owner (no seed data, currency chosen at setup). */
export const emptyBusiness: BusinessInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  whatsapp: "",
  currency: "",
  logoUrl: "",
  discountsEnabled: true,
  websiteUrl: "",
};

const store = createPersistentStore<BusinessInfo>(STORAGE_KEY, emptyBusiness);

function getSnapshot(): BusinessInfo {
  // One-time fallback: seed the new bizmate cache from the old bizflow
  // cache on first read. The legacy key itself is left untouched.
  if (typeof window !== "undefined") {
    try {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && !window.localStorage.getItem(STORAGE_KEY)) {
        store.set(JSON.parse(legacy) as BusinessInfo);
      }
    } catch {
      // Corrupt legacy data: ignore, the empty default applies.
    }
  }
  return store.get();
}

function getServerSnapshot(): BusinessInfo {
  return emptyBusiness;
}

function subscribe(listener: () => void): () => void {
  return store.subscribe(listener);
}

export type BusinessStatus = "loading" | "ready" | "error";

interface BusinessStore {
  business: BusinessInfo;
  status: BusinessStatus;
  updateBusiness: (input: Partial<BusinessInfo>) => void;
  /** Re-read the database (e.g. after saving in Settings). */
  reload: () => void;
}

const BusinessContext = createContext<BusinessStore | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const business = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // "loading" until the first DB read resolves; "ready" = setup can decide.
  const [status, setStatus] = useState<BusinessStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  const updateBusiness = useCallback((input: Partial<BusinessInfo>) => {
    store.set({ ...store.get(), ...input });
  }, []);

  // Always sync from Supabase on start (and after reload): the cached
  // localStorage copy may be stale or belong to a previous session. The
  // database is the source of truth for who owns what.
  useEffect(() => {
    let cancelled = false;
    loadBusiness().then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") {
        // The real business replaces whatever the cache held. Nothing is
        // seeded: a user with no business stays empty until setup runs.
        store.set({ ...result.business });
        setStatus("ready");
      } else if (result.kind === "empty") {
        // Signed in with no business yet — the SetupGate shows setup.
        store.set({ ...emptyBusiness });
        setStatus("ready");
      } else if (result.kind === "no-config") {
        // Demo mode without credentials: leave the cache untouched.
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ business, status, updateBusiness, reload }),
    [business, status, updateBusiness, reload],
  );

  return (
    <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
  );
}

/** Module-level access for data layers that need the current business values. */
export function getBusinessInfo(): BusinessInfo {
  return store.get();
}

/** Module-level setter for data layers (e.g. caching the database row id). */
export function updateBusinessInfo(input: Partial<BusinessInfo>): void {
  store.set({ ...store.get(), ...input });
}

export function useBusiness(): BusinessStore {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
