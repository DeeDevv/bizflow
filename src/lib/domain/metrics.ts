"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Business metrics (Phase 4) — derived ONLY from processed events, so the
 * dashboard, sales page, and receipts can never disagree (one source of
 * truth, spec §20).
 *
 * The critical distinction (spec §10):
 *   saleValue      — what customers owe (transaction totals)
 *   moneyReceived  — cash actually collected (payments)
 *   outstanding    — saleValue − moneyReceived
 *
 * An unpaid ₦1,000,000 sale moves saleValue and outstanding — NOT
 * moneyReceived.
 */

export interface BusinessMetrics {
  /** Sum of all completed sale totals. */
  saleValue: number;
  /** Sum of all payments actually received. */
  moneyReceived: number;
  /** saleValue − moneyReceived (≥ 0). */
  outstanding: number;
  /** Number of completed sales. */
  salesCount: number;
}

export const emptyMetrics: BusinessMetrics = {
  saleValue: 0,
  moneyReceived: 0,
  outstanding: 0,
  salesCount: 0,
};

function recompute(m: BusinessMetrics): BusinessMetrics {
  return { ...m, outstanding: Math.max(0, m.saleValue - m.moneyReceived) };
}

const store = createPersistentStore<BusinessMetrics>("bizmate.metrics.v1", emptyMetrics);

const EMPTY = emptyMetrics;

function getSnapshot(): BusinessMetrics {
  return store.get();
}

function getServerSnapshot(): BusinessMetrics {
  return EMPTY;
}

/** Apply a completed sale: value always; received only what was paid. */
export function applySaleToMetrics(input: {
  total: number;
  amountPaid: number;
}): void {
  const m = store.get();
  store.set(
    recompute({
      ...m,
      saleValue: m.saleValue + input.total,
      moneyReceived: m.moneyReceived + input.amountPaid,
      salesCount: m.salesCount + 1,
    }),
  );
}

/** Apply a later payment against an existing sale (part → full, etc.). */
export function applyPaymentToMetrics(amount: number): void {
  const m = store.get();
  store.set(recompute({ ...m, moneyReceived: m.moneyReceived + amount }));
}

export function useBusinessMetrics(): BusinessMetrics {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
