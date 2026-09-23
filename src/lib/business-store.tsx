"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { BusinessInfo } from "./types";
import { businessInfo as seedBusinessInfo } from "./mock-data";
import { createPersistentStore } from "./persistent-store";
import { loadBusiness } from "./business-db";

/**
 * Business settings store — the "enter it once, reuse it everywhere" hub.
 * The business name, logo, phone/WhatsApp, address, and currency saved here
 * flow automatically onto invoices, receipts, and sale records.
 */

const STORAGE_KEY = "bizflow.business.v1";

const store = createPersistentStore<BusinessInfo>(STORAGE_KEY, seedBusinessInfo);

function getSnapshot(): BusinessInfo {
  return store.get();
}

function getServerSnapshot(): BusinessInfo {
  return seedBusinessInfo;
}

function subscribe(listener: () => void): () => void {
  return store.subscribe(listener);
}

interface BusinessStore {
  business: BusinessInfo;
  updateBusiness: (input: Partial<BusinessInfo>) => void;
}

const BusinessContext = createContext<BusinessStore | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const business = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateBusiness = useCallback((input: Partial<BusinessInfo>) => {
    store.set({ ...store.get(), ...input });
  }, []);

  // Hydrate from Supabase on start so a fresh browser shows the real
  // business (name, currency, etc.) without having to visit Settings
  // first. Skipped when the cache already holds a synced business.
  useEffect(() => {
    let cancelled = false;
    loadBusiness().then((result) => {
      if (cancelled || result.kind !== "ok") return;
      const current = store.get();
      if (current.id) return;
      store.set({ ...current, ...result.business });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ business, updateBusiness }),
    [business, updateBusiness],
  );

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
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
