"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Invoice, InvoiceInput, InvoicePayment } from "./types";
import { seedInvoices } from "./mock-data";
import { getSupabaseClient } from "./supabase";
import { ensureBusinessId } from "./products-db";
import {
  createInvoiceInDb,
  finalizeInvoiceSaleInDb,
  loadInvoices,
} from "./invoices-db";
import {
  loadPayments,
  recordInvoicePaymentInDb,
} from "./payments-db";

/**
 * Invoice + payment store (Phases 5.7–5.8): invoices, their items and their
 * payments live in Supabase and are loaded when the app starts. Creating
 * saves with the price snapshot baked in; finalizing a sale goes through
 * the atomic `finalize_invoice_sale` function (paid + stock deduction in
 * one transaction, impossible to double-apply). Payments go through the
 * atomic `record_invoice_payment` function, which validates the remaining
 * balance and only marks the invoice paid when payments reach the total.
 * The component-facing API is unchanged from the localStorage version —
 * computed "overdue" still happens at read time via effectiveStatus.
 */

export type InvoicesStatus = "loading" | "ready" | "error";

interface InvoicesStore {
  invoices: Invoice[];
  /** Real payment records, newest first. */
  payments: InvoicePayment[];
  status: InvoicesStatus;
  /** Last database error, shown by the page; null when everything is fine. */
  error: string | null;
  reload: () => void;
  clearError: () => void;
  /** Next invoice number, e.g. "INV-2044" (assigned for real at save time). */
  nextNumber: () => string;
  createInvoice: (input: InvoiceInput) => Promise<Invoice | null>;
  updateInvoice: (id: string, input: InvoiceInput) => Promise<Invoice | null>;
  markAsPaid: (id: string) => Promise<boolean>;
  /** Record a payment; the database validates the remaining balance. */
  recordPayment: (
    id: string,
    amount: number,
    note?: string,
  ) => Promise<{ ok: boolean }>;
  /** Sum of real payment records for an invoice. */
  paidFor: (invoiceId: string) => number;
}

/** Highest "INV-####" number in a list, for generating the next one. */
function maxInvoiceNumber(invoices: Invoice[]): number {
  const nums = invoices
    .map((inv) => Number.parseInt(inv.number.replace("INV-", ""), 10))
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 ? Math.max(...nums) : 2040;
}

const InvoicesContext = createContext<InvoicesStore | null>(null);

export function InvoicesProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [status, setStatus] = useState<InvoicesStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the initial load ("Try again" after an error).
  const [attempt, setAttempt] = useState(0);

  // Re-render at most once a minute so computed "overdue" stays truthful.
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock((c) => Math.min(c + 1, 1000)), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadInvoices(), loadPayments()]).then(([invResult, payResult]) => {
      if (cancelled) return;
      if (invResult.kind === "ok") {
        setInvoices(invResult.invoices);
        setStatus("ready");
        setError(null);
      } else if (invResult.kind === "no-config") {
        // Demo mode without credentials: keep the mock data working.
        setInvoices(seedInvoices);
        setStatus("ready");
      } else {
        setStatus("error");
        setError(invResult.message);
      }
      setPayments(payResult.kind === "ok" ? payResult.payments : []);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const nextNumber = useCallback((): string => {
    return `INV-${maxInvoiceNumber(invoices) + 1}`;
  }, [invoices]);

  const createInvoice = useCallback(
    async (input: InvoiceInput): Promise<Invoice | null> => {
      const proposedNumber = `INV-${maxInvoiceNumber(invoices) + 1}`;
      // Optimistic row so the UI feels instant; replaced by the saved row.
      const tempId = `temp-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const optimistic: Invoice = {
        id: tempId,
        number: proposedNumber,
        ...input,
        ...(input.status === "paid" ? { paidAt: input.issueDate } : {}),
      };
      setInvoices((prev) => [optimistic, ...prev]);

      const result = await createInvoiceInDb(input, proposedNumber);
      if (result.kind === "ok" && result.invoice) {
        const saved = result.invoice;
        setInvoices((prev) => prev.map((inv) => (inv.id === tempId ? saved : inv)));
        setError(null);
        return saved;
      }
      // Roll back and surface the error (message shown by the caller/page).
      setInvoices((prev) => prev.filter((inv) => inv.id !== tempId));
      if (result.kind === "error") setError(result.message);
      return null;
    },
    [invoices],
  );

  const updateInvoice = useCallback(
    async (id: string, input: InvoiceInput): Promise<Invoice | null> => {
      const previous = invoices.find((inv) => inv.id === id) ?? null;
      if (!previous) return null;

      // Optimistic update — same merge as the localStorage version.
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, ...input } : inv)),
      );

      const businessId = await ensureBusinessId();
      if (businessId.kind !== "ok") return { ...previous, ...input };

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

        // Core invoice fields. Stock is NOT re-deducted here: deduction is
        // owned exclusively by finalize_invoice_sale, so editing (even a
        // paid invoice) can never double-deduct or sneak units back.
        const { error: invError } = await client
          .from("invoices")
          .update({
            issue_date: input.issueDate,
            due_date: input.dueDate,
            status: input.status,
            discount_type:
              input.discount && input.discount.value > 0 ? input.discount.type : null,
            discount_value:
              input.discount && input.discount.value > 0 ? input.discount.value : null,
            subtotal: Math.round(subtotal * 100) / 100,
            total,
          })
          .eq("id", id);
        if (invError) throw new Error(invError.message);

        // Replace the line items (delete + re-insert; cascade-safe).
        const { error: delError } = await client
          .from("invoice_items")
          .delete()
          .eq("invoice_id", id);
        if (delError) throw new Error(delError.message);

        // Re-link replacement items to catalog products by exact name.
        const { data: prodRows } = await client
          .from("products")
          .select("id, name")
          .eq("business_id", businessId.id);
        const productIdByName = new Map(
          ((prodRows ?? []) as { id: string; name: string }[]).map((p) => [p.name, p.id]),
        );

        const { error: itemError } = await client.from("invoice_items").insert(
          input.items.map((it) => ({
            invoice_id: id,
            product_id: productIdByName.get(it.description) ?? null,
            description: it.description,
            quantity: Math.max(1, Math.round(it.quantity)),
            unit_price: Math.max(0, it.unitPrice),
          })),
        );
        if (itemError) throw new Error(itemError.message);

        setError(null);
        return { ...previous, ...input };
      } catch (err) {
        // Roll back to the previous state; the page shows the message.
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? previous : inv)),
        );
        setError(err instanceof Error ? err.message : "Unknown database error.");
        return null;
      }
    },
    [invoices],
  );

  const markAsPaid = useCallback(
    async (id: string): Promise<boolean> => {
      const previous = invoices.find((inv) => inv.id === id) ?? null;
      if (!previous) return false;

      // Optimistic paid state.
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? {
                ...inv,
                status: "paid" as const,
                paidAt: inv.paidAt ?? new Date().toISOString().slice(0, 10),
              }
            : inv,
        ),
      );

      // Atomic finalize: paid + stock deduction in one database transaction.
      // Repeated calls are no-ops inside the function (no double deduction).
      const result = await finalizeInvoiceSaleInDb(id);
      if (result.kind === "ok") {
        setError(null);
        return true;
      }
      if (result.kind === "error") setError(result.message);
      if (previous) {
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? previous : inv)));
      }
      return false;
    },
    [invoices],
  );

  const recordPayment = useCallback(
    async (
      id: string,
      amount: number,
      note?: string,
    ): Promise<{ ok: boolean }> => {
      // The database validates everything (positive amount, remaining
      // balance) atomically; a rejected payment changes nothing.
      const result = await recordInvoicePaymentInDb(id, amount, note);
      if (result.kind === "ok") {
        setPayments((prev) => [result.payment, ...prev]);
        if (result.invoicePaid) {
          setInvoices((prev) =>
            prev.map((inv) =>
              inv.id === id
                ? {
                    ...inv,
                    status: "paid" as const,
                    paidAt:
                      inv.paidAt ?? result.payment.paidAt.slice(0, 10),
                  }
                : inv,
            ),
          );
        }
        setError(null);
        return { ok: true };
      }
      if (result.kind === "error") setError(result.message);
      return { ok: false };
    },
    [],
  );

  const paidFor = useCallback(
    (invoiceId: string): number =>
      payments
        .filter((p) => p.invoiceId === invoiceId)
        .reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const value = useMemo(
    () => ({
      invoices,
      payments,
      status,
      error,
      reload,
      clearError,
      nextNumber,
      createInvoice,
      updateInvoice,
      markAsPaid,
      recordPayment,
      paidFor,
    }),
    [invoices, payments, status, error, reload, clearError, nextNumber, createInvoice, updateInvoice, markAsPaid, recordPayment, paidFor],
  );

  return (
    <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>
  );
}

export function useInvoices(): InvoicesStore {
  const ctx = useContext(InvoicesContext);
  if (!ctx) throw new Error("useInvoices must be used within InvoicesProvider");
  return ctx;
}
