"use client";

/**
 * Supabase data access for Payments (Phase 5.8).
 * Recording a payment goes through `record_invoice_payment` (migration
 * 0007): one atomic transaction that validates the remaining balance,
 * stores the payment row, and marks the invoice paid (with the single
 * Phase 5.7 stock deduction) only when payments reach the invoice total.
 * No auth yet — the anon policies from 0007 allow the app to read/write.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { InvoicePayment } from "./types";
import { ensureBusinessId } from "./products-db";

/** A row from the `payments` table, as Supabase returns it. */
interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: string | number;
  note: string | null;
  method: string | null;
  paid_at: string;
}

export type RecordPaymentResult =
  | { kind: "ok"; payment: InvoicePayment; totalPaid: number; invoicePaid: boolean }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

export type LoadPaymentsResult =
  | { kind: "ok"; payments: InvoicePayment[] }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

function rowToPayment(row: PaymentRow): InvoicePayment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    note: row.note,
    method: row.method,
    paidAt: row.paid_at,
  };
}

/**
 * Record a payment against an invoice. The database refuses non-positive
 * amounts and overpayments; the returned result carries the new totals.
 */
export async function recordInvoicePaymentInDb(
  invoiceId: string,
  amount: number,
  note?: string,
): Promise<RecordPaymentResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { kind: "error", message: "Payment amount must be greater than zero." };
  }
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("record_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: Math.round(amount * 100) / 100,
      p_note: note?.trim() ? note.trim() : null,
    });
    if (error) return { kind: "error", message: error.message };
    const payload = data as {
      payment_id: string;
      paid_at: string;
      total_paid: string | number;
      invoice_paid: boolean;
    };
    return {
      kind: "ok",
      payment: {
        id: payload.payment_id,
        invoiceId,
        amount: Math.round(amount * 100) / 100,
        note: note?.trim() ?? null,
        method: null,
        paidAt: payload.paid_at,
      },
      totalPaid: Number(payload.total_paid),
      invoicePaid: payload.invoice_paid,
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Load the business's payments (newest first), for paid/remaining math. */
export async function loadPayments(): Promise<LoadPaymentsResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("business_id", businessId.id)
      .order("paid_at", { ascending: false });

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", payments: ((data ?? []) as PaymentRow[]).map(rowToPayment) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
