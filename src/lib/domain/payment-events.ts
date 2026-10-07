"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Payment events (Phase 8.5, spec §6 + §7).
 *
 * A payment is an EVENT, never an overwrite: every amount received against a
 * transaction is recorded individually (₦400,000, then ₦600,000 — two
 * events, one invoice). The transaction's amountPaid/balance are derived
 * from these events plus the payment made at sale time, so history can
 * never be lost. A receipt can be produced per event.
 *
 * Methods are what the employee recorded (Cash / Bank Transfer / POS /
 * Other) — BizMate does NOT pretend to confirm transfers or POS payments;
 * a real gateway integration would own that later.
 */

export type PaymentMethod = "cash" | "transfer" | "pos" | "other";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  transfer: "Bank Transfer",
  pos: "POS",
  other: "Other",
};

export interface PaymentEvent {
  id: string;
  /** The transaction this payment is against, e.g. "BM-1024". */
  saleRef: string;
  amount: number;
  method: PaymentMethod;
  /** Optional note from the person recording it. */
  note: string | null;
  /** Who recorded the payment (employee/manager attribution, spec §2). */
  recordedBy: string;
  /** ISO timestamp. */
  at: string;
}

const MAX_EVENTS = 500;

const store = createPersistentStore<PaymentEvent[]>("bizmate.payment-events.v1", []);

const EMPTY: PaymentEvent[] = [];

function getSnapshot(): PaymentEvent[] {
  return store.get();
}

function getServerSnapshot(): PaymentEvent[] {
  return EMPTY;
}

function newId(): string {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Record one payment event. Called by the engine's recordPaymentOnSale —
 * never directly from UI, so validation and metric updates can't be skipped.
 */
export function recordPaymentEvent(
  input: Omit<PaymentEvent, "id" | "at">,
): PaymentEvent {
  const full: PaymentEvent = {
    id: newId(),
    at: new Date().toISOString(),
    ...input,
  };
  store.set([full, ...store.get()].slice(0, MAX_EVENTS));
  return full;
}

/** All payment events against one transaction, oldest first. */
export function paymentsForSale(saleRef: string): PaymentEvent[] {
  return store
    .get()
    .filter((p) => p.saleRef === saleRef)
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Sum of later payments recorded against a transaction (excluding sale-time payment). */
export function laterPaymentsTotal(saleRef: string): number {
  return paymentsForSale(saleRef).reduce((sum, p) => sum + p.amount, 0);
}

/** All payment events, newest first (Operations Center payments view). */
export function usePaymentEvents(): PaymentEvent[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}
