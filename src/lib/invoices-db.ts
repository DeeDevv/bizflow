"use client";

/**
 * Supabase data access for Invoices (Phase 5.7).
 * Maps the app's camelCase `Invoice`/`InvoiceItem` onto the
 * `invoices` + `invoice_items` tables. No auth yet — the anon policies from
 * migration 0006 allow the app to read and write.
 *
 * Money values (unit_price, subtotal, total) are stored on the invoice so
 * historical documents never change when product prices change later.
 * Finalizing a sale goes through `finalize_invoice_sale` (0006): paid +
 * stock deduction in one atomic transaction, impossible to double-apply.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Invoice, InvoiceInput } from "./types";
import { ensureBusinessId } from "./products-db";

/** A row from the `invoices` table, as Supabase returns it. */
interface InvoiceRow {
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: string;
  discount_type: string | null;
  discount_value: string | number | null;
  subtotal: string | number;
  total: string | number;
  paid_at: string | null;
}

/** A row from the `invoice_items` table. */
interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: string | number;
}

export type LoadInvoicesResult =
  | { kind: "ok"; invoices: Invoice[] }
  | { kind: "no-config" }
  | { kind: "no-business" }
  | { kind: "error"; message: string };

export type MutationResult =
  | { kind: "ok"; invoice?: Invoice }
  | { kind: "no-config" }
  | { kind: "no-business" }
  | { kind: "error"; message: string };

export type FinalizeResult =
  | { kind: "ok" }
  | { kind: "no-config" }
  | { kind: "no-business" }
  | { kind: "error"; message: string };

function num(value: string | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function rowToInvoice(row: InvoiceRow, items: InvoiceItemRow[]): Invoice {
  return {
    id: row.id,
    number: row.invoice_number,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    items: items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: num(it.unit_price),
    })),
    discount:
      row.discount_type && row.discount_value != null
        ? { type: row.discount_type as "percent" | "fixed", value: num(row.discount_value) }
        : null,
    status:
      row.status === "paid" || row.status === "pending" || row.status === "draft"
        ? row.status
        : "pending",
    ...(row.paid_at ? { paidAt: row.paid_at.slice(0, 10) } : {}),
  };
}

/**
 * Load the business's invoices with their items, newest first.
 * Two queries (invoices, then their items) instead of an embedded select so
 * the mapping stays simple and explicit.
 */
export async function loadInvoices(): Promise<LoadInvoicesResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();

    const { data: invRows, error: invError } = await client
      .from("invoices")
      .select("*")
      .eq("business_id", businessId.id)
      .order("created_at", { ascending: false });

    if (invError) return { kind: "error", message: invError.message };
    const rows = (invRows ?? []) as InvoiceRow[];
    if (rows.length === 0) return { kind: "ok", invoices: [] };

    const { data: itemRows, error: itemError } = await client
      .from("invoice_items")
      .select("*")
      .in(
        "invoice_id",
        rows.map((r) => r.id),
      );

    if (itemError) return { kind: "error", message: itemError.message };
    const allItems = (itemRows ?? []) as InvoiceItemRow[];

    return {
      kind: "ok",
      invoices: rows.map((row) =>
        rowToInvoice(
          row,
          allItems.filter((it) => it.invoice_id === row.id),
        ),
      ),
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/**
 * Create an invoice with its items. Prices are taken from the form's
 * snapshot (the product's current price at the time of sale), so the stored
 * document is immune to later price changes. Returns the saved invoice
 * with its real database id.
 */
export async function createInvoiceInDb(
  input: InvoiceInput,
  number: string,
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();

    const subtotal = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unitPrice,
      0,
    );
    const discountValue =
      input.discount && input.discount.value > 0 && subtotal > 0
        ? input.discount.type === "percent"
          ? (subtotal * Math.min(input.discount.value, 100)) / 100
          : input.discount.value
        : 0;
    const total = Math.max(
      0,
      Math.round((subtotal - Math.min(discountValue, subtotal)) * 100) / 100,
    );

    const { data: invRow, error: invError } = await client
      .from("invoices")
      .insert({
        business_id: businessId.id,
        customer_id: input.customerId,
        invoice_number: number,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        status: input.status === "paid" ? "paid" : "pending",
        discount_type:
          input.discount && input.discount.value > 0 ? input.discount.type : null,
        discount_value:
          input.discount && input.discount.value > 0 ? input.discount.value : null,
        subtotal: Math.round(subtotal * 100) / 100,
        total,
        ...(input.status === "paid" ? { paid_at: new Date().toISOString() } : {}),
      })
      .select("*")
      .single();

    if (invError) return { kind: "error", message: invError.message };
    const invoice = invRow as InvoiceRow;

    // Link lines to catalog products by exact name: the database deducts
    // stock only for product-linked items when the sale is finalized.
    const { data: prodRows } = await client
      .from("products")
      .select("id, name")
      .eq("business_id", businessId.id);
    const productIdByName = new Map(
      ((prodRows ?? []) as { id: string; name: string }[]).map((p) => [p.name, p.id]),
    );

    const itemPayload = input.items.map((it) => ({
      invoice_id: invoice.id,
      product_id: productIdByName.get(it.description) ?? null,
      description: it.description,
      quantity: Math.max(1, Math.round(it.quantity)),
      unit_price: Math.max(0, it.unitPrice),
    }));
    const { error: itemError } = await client
      .from("invoice_items")
      .insert(itemPayload);

    if (itemError) {
      // The invoice row exists but its items failed — surface it; the
      // store rolls the UI back and the error explains what happened.
      return { kind: "error", message: itemError.message };
    }

    return { kind: "ok", invoice: rowToInvoice(invoice, itemPayload as InvoiceItemRow[]) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/**
 * Finalize an invoice as a completed sale — the ONE path that deducts
 * stock. Runs `finalize_invoice_sale` (0006): atomically marks the invoice
 * paid and deducts every product-linked item's quantity. Safe to call
 * repeatedly (idempotent) and safe under simultaneous sales.
 */
export async function finalizeInvoiceSaleInDb(
  invoiceId: string,
): Promise<FinalizeResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { error } = await client.rpc("finalize_invoice_sale", {
      p_invoice_id: invoiceId,
    });
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok" };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
