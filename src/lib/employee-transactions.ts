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

/**
 * Update one transaction's financial state in place (Phase 8.5, spec §6):
 * later payments re-derive amountPaid/balance/status. Payment HISTORY is
 * never touched — it lives in the payment-events store; this only refreshes
 * the transaction's current derived state.
 */
export function updateCompletedSale(
  ref: string,
  patch: Partial<Pick<CompletedSale, "amountPaid" | "balance" | "paymentStatus" | "method">>,
): void {
  store.set(
    store.get().map((s) => (s.reference === ref ? { ...s, ...patch } : s)),
  );
}

export function useEmployeeTransactions(): CompletedSale[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
