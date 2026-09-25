"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Customer purchase history (Phase 4).
 *
 * Completed sales attach themselves to the customer's history automatically
 * (one input → many outputs). Walk-in customers never create permanent
 * records. When the backend arrives this becomes a query over the sales
 * table — the shape mirrors what that query will return.
 */

export interface PurchaseRecord {
  id: string;
  /** The transaction reference, e.g. "BM-1024". */
  saleRef: string;
  customerId: string;
  customerName: string;
  /** Flattened items for simple history display. */
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  amountPaid: number;
  /** Outstanding balance on this purchase. */
  balance: number;
  paymentStatus: "paid" | "part" | "unpaid";
  /** ISO timestamp of the sale. */
  at: string;
}

const store = createPersistentStore<PurchaseRecord[]>("bizmate.customer-history.v1", []);

const EMPTY: PurchaseRecord[] = [];

function getSnapshot(): PurchaseRecord[] {
  return store.get();
}

function getServerSnapshot(): PurchaseRecord[] {
  return EMPTY;
}

/** Attach a completed sale to the customer's history (no-op for walk-ins). */
export function recordPurchase(input: Omit<PurchaseRecord, "id">): void {
  if (!input.customerId) return; // walk-in: no permanent record (spec §11)
  const full: PurchaseRecord = {
    id: `pur-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ...input,
  };
  store.set([full, ...store.get()]);
}

/** History for one customer, newest first. */
export function purchasesForCustomer(customerId: string): PurchaseRecord[] {
  return store
    .get()
    .filter((p) => p.customerId === customerId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Customer's total spent and total still owed — computed once, reused everywhere. */
export function customerPurchaseTotals(customerId: string): {
  totalSpent: number;
  outstanding: number;
  count: number;
} {
  const records = purchasesForCustomer(customerId);
  return {
    totalSpent: records.reduce((s, p) => s + p.total, 0),
    outstanding: records.reduce((s, p) => s + p.balance, 0),
    count: records.length,
  };
}

export function useCustomerHistory(): PurchaseRecord[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
