"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";

/**
 * Activity history (Phase 3 foundation).
 *
 * "Employee → action → subject → time" entries recorded from employee
 * actions (sales, customer additions, stock received). Local/mock for now:
 * when the backend arrives this becomes the real activity_log table, so the
 * shape is deliberately event-like (kind + label + ids) per the Phase 3
 * event structure (SALE_COMPLETED, CUSTOMER_ADDED, STOCK_RECEIVED).
 */

export type ActivityKind =
  | "sale_completed"
  | "customer_added"
  | "stock_received"
  | "stock_adjusted"
  | "payment_recorded";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** Who did it (employee display name). */
  actor: string;
  /** Human-readable one-liner, e.g. "completed sale BM-1024". */
  label: string;
  /** Related record ids for the future automation engine to link up. */
  saleRef?: string;
  customerId?: string;
  productId?: string;
  /** ISO timestamp. */
  at: string;
}

const MAX_ENTRIES = 100;

const EMPTY: ActivityEntry[] = [];

const store = createPersistentStore<ActivityEntry[]>("bizmate.activity.v1", EMPTY);

function getSnapshot(): ActivityEntry[] {
  return store.get();
}

function getServerSnapshot(): ActivityEntry[] {
  return EMPTY;
}

export function recordActivity(
  entry: Omit<ActivityEntry, "id" | "at">,
): void {
  const full: ActivityEntry = {
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  store.set([full, ...store.get()].slice(0, MAX_ENTRIES));
}

export function useActivity(): ActivityEntry[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** "10:42 AM" style time for activity lists. */
export function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
