"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";
import type { CompletedSale } from "./employee-sales";

/**
 * Employee transaction history (Phase 3) — completed sales, newest first.
 * Local/mock records now; becomes a real query when the backend lands.
 */

const EMPTY: CompletedSale[] = [];

const store = createPersistentStore<CompletedSale[]>("bizmate.employee-sales.v1", EMPTY);

function getSnapshot(): CompletedSale[] {
  return store.get();
}

function getServerSnapshot(): CompletedSale[] {
  return EMPTY;
}

export function recordCompletedSale(sale: CompletedSale): void {
  store.set([sale, ...store.get()]);
}

export function useEmployeeTransactions(): CompletedSale[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
