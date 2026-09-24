"use client";

/**
 * Supabase data access for Receipts (Phase 5.9).
 * Creating goes through `create_receipt_for_payment` (migration 0008): one
 * atomic transaction that freezes the full JSONB snapshot and is
 * idempotent per payment — reopening a payment never duplicates a receipt.
 * Rendering uses ONLY the frozen snapshot, so old receipts stay accurate
 * even when business/customer/product/currency details change later.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { ReceiptSnapshot } from "./types";
import { ensureBusinessId } from "./products-db";

/** A row from the `receipts` table, as Supabase returns it. */
interface ReceiptRow {
  id: string;
  business_id: string;
  payment_id: string;
  receipt_number: string;
  issued_at: string;
  snapshot: ReceiptSnapshot;
}

export type GetOrCreateResult =
  | { kind: "ok"; receiptId: string; created: boolean }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

export type LoadReceiptsResult =
  | { kind: "ok"; receipts: { id: string; receiptNumber: string; paymentId: string; issuedAt: string; snapshot: ReceiptSnapshot }[] }
  | { kind: "no-config" }
  | { kind: "no-business" }
  | { kind: "error"; message: string };

/** Create the receipt for a payment (or return the existing one's id). */
export async function getOrCreateReceiptForPayment(
  paymentId: string,
): Promise<GetOrCreateResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("create_receipt_for_payment", {
      p_payment_id: paymentId,
    });
    if (error) return { kind: "error", message: error.message };
    // The function returns the receipt id in both cases; `created` is worked
    // out by the caller from the receipts store state.
    return { kind: "ok", receiptId: data as string, created: true };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Load the business's receipts, newest first. */
export async function loadReceipts(): Promise<LoadReceiptsResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("receipts")
      .select("*")
      .eq("business_id", businessId.id)
      .order("created_at", { ascending: false });

    if (error) return { kind: "error", message: error.message };
    const rows = (data ?? []) as ReceiptRow[];
    return {
      kind: "ok",
      receipts: rows.map((r) => ({
        id: r.id,
        receiptNumber: r.receipt_number,
        paymentId: r.payment_id,
        issuedAt: r.issued_at,
        snapshot: r.snapshot,
      })),
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
