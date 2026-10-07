"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";
import { getBusinessInfo } from "./business-store";
import { formatMoney } from "./currency-symbol";

/**
 * Employee sale draft (Phase 3).
 *
 * The current in-progress sale for the New Sale workflow. It persists across
 * navigation (so creating a customer never loses the sale) and resets when a
 * sale completes or the employee discards it.
 *
 * This is UI state, NOT the automation engine: completion is structured as a
 * SALE_COMPLETED event boundary (see completeSaleDraft) so Phase 4 can wire
 * inventory/payments/receipts/activity in one place.
 */

export interface SaleItem {
  productId: string;
  name: string;
  /** Denormalized from the catalog — never re-typed by the employee. */
  code: string;
  category: string;
  /** Final unit price actually charged (catalog price — employees cannot edit it). */
  unitPrice: number;
  /**
   * PRICING SNAPSHOT (Phase 8.5, spec §4): frozen at add-to-sale time so a
   * later product/discount change can NEVER rewrite history. The catalog
   * price lives on; the transaction keeps what the customer actually paid.
   */
  pricing: {
    /** List price before discount, at sale time. */
    regularPrice: number;
    /** Discount % the manager had configured, at sale time. */
    discountPercent: number;
    /** regular − final, per unit, at sale time. */
    discountAmount: number;
    /** What one unit actually sold for. */
    finalUnitPrice: number;
  };
  quantity: number;
  /** Stock at the time the item was added, for availability messages. */
  availableStock: number;
}

export type PaymentStatus = "paid" | "part" | "unpaid";

export interface SaleDraft {
  items: SaleItem[];
  /** null = walk-in customer. */
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  paymentStatus: PaymentStatus;
  method: "cash" | "transfer" | "pos" | "other" | null;
  amountPaid: number;
  /** Optional whole-sale discount (percent) — existing BizMate concept. */
  discountPercent: number | null;
  startedAt: string | null;
  /**
   * Stable id of the employee/actor building this draft (spec §2). null =
   * the owner previewing. Attribution lands on the CompletedSale record.
   */
  actorId: string | null;
  /** Operational role at draft time — "employee" | "manager" | "owner". */
  actorRole: "owner" | "manager" | "employee";
}

export function emptySaleDraft(): SaleDraft {
  return {
    items: [],
    customerId: null,
    customerName: "",
    customerPhone: "",
    paymentStatus: "paid",
    method: null,
    amountPaid: 0,
    discountPercent: null,
    startedAt: null,
    actorId: null,
    actorRole: "owner",
  };
}

/** Human reference for receipts/transactions, e.g. "BM-1024". */
export function nextSaleReference(): string {
  const raw = localStorage.getItem("bizmate.sale-seq.v1");
  const seq = raw ? Number.parseInt(raw, 10) || 1024 : 1024;
  localStorage.setItem("bizmate.sale-seq.v1", String(seq + 1));
  return `BM-${seq}`;
}

const store = createPersistentStore<SaleDraft>("bizmate.sale-draft.v1", emptySaleDraft());

/** Stable empty draft for SSR (getServerSnapshot must return a cached value). */
const EMPTY_DRAFT: SaleDraft = emptySaleDraft();

function getSnapshot(): SaleDraft {
  return store.get();
}

function getServerSnapshot(): SaleDraft {
  return EMPTY_DRAFT;
}

export function updateSaleDraft(input: Partial<SaleDraft>): void {
  const current = store.get();
  store.set({
    ...current,
    ...input,
    startedAt: current.startedAt ?? new Date().toISOString(),
  });
}

export function resetSaleDraft(): void {
  store.set(emptySaleDraft());
}

/** Subtotal before discount. */
export function saleSubtotal(draft: SaleDraft): number {
  return draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

/** Discount amount (percent off the subtotal). */
export function saleDiscountAmount(draft: SaleDraft): number {
  if (!draft.discountPercent) return 0;
  return Math.round(saleSubtotal(draft) * (draft.discountPercent / 100));
}

/** Final total after discount — never negative. */
export function saleTotal(draft: SaleDraft): number {
  return Math.max(0, saleSubtotal(draft) - saleDiscountAmount(draft));
}

/** Balance due for part/unpaid sales. */
export function saleBalance(draft: SaleDraft): number {
  if (draft.paymentStatus === "paid") return 0;
  if (draft.paymentStatus === "unpaid") return saleTotal(draft);
  return Math.max(0, saleTotal(draft) - draft.amountPaid);
}

/** Add a catalog product to the sale (quantity clamped to available stock). */
/**
 * Add a catalog product to the sale (quantity clamped to available stock).
 * Phase 8.5: the product is passed with its PRICING SNAPSHOT (regular
 * price, discount %, discount amount, final unit price) frozen here — the
 * transaction later stores this verbatim (spec §4, history protection).
 */
export function addItemToSale(
  product: {
    id: string;
    name: string;
    code: string;
    category: string;
    price: number;
    stock: number;
    /** Frozen manager pricing at add time (final price = charged price). */
    pricing: SaleItem["pricing"];
  },
  quantity = 1,
): { ok: boolean; message?: string } {
  if (product.stock <= 0) {
    return { ok: false, message: "This product is out of stock." };
  }
  const draft = store.get();
  const existing = draft.items.find((i) => i.productId === product.id);
  const currentQty = existing?.quantity ?? 0;
  if (currentQty + quantity > product.stock) {
    return {
      ok: false,
      message: `Not enough stock available. Only ${product.stock - currentQty} more unit${
        product.stock - currentQty === 1 ? "" : "s"
      } can be added.`,
    };
  }
  const items = existing
    ? draft.items.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i,
      )
    : [
        ...draft.items,
        {
          productId: product.id,
          name: product.name,
          code: product.code,
          category: product.category,
          unitPrice: product.pricing.finalUnitPrice,
          pricing: product.pricing,
          quantity,
          availableStock: product.stock,
        },
      ];
  updateSaleDraft({ items });
  return { ok: true };
}

export function setSaleItemQuantity(productId: string, quantity: number): void {
  const draft = store.get();
  if (quantity <= 0) {
    updateSaleDraft({ items: draft.items.filter((i) => i.productId !== productId) });
    return;
  }
  updateSaleDraft({
    items: draft.items.map((i) =>
      i.productId === productId
        ? { ...i, quantity: Math.min(quantity, i.availableStock) }
        : i,
    ),
  });
}

export function removeSaleItem(productId: string): void {
  updateSaleDraft({
    items: store.get().items.filter((i) => i.productId !== productId),
  });
}

export function useSaleDraft(): SaleDraft {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** A finished sale, as shown on the success screen, receipt, and history. */
export interface CompletedSale {
  reference: string;
  items: SaleItem[];
  subtotal: number;
  discountPercent: number | null;
  discountAmount: number;
  total: number;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  paymentStatus: PaymentStatus;
  method: SaleDraft["method"];
  amountPaid: number;
  balance: number;
  /** Employee display name (mock session for now). */
  employeeName: string;
  /**
   * Attribution (Phase 8.5, spec §2): stable actor id + operational role
   * + business id, so every transaction is individually attributable.
   */
  employeeId: string;
  employeeRole: "owner" | "manager" | "employee";
  businessId: string | null;
  /** ISO timestamps. */
  completedAt: string;
}

export type CompletedSaleEvent =
  | { kind: "ok"; sale: CompletedSale }
  | { kind: "error"; message: string };

/**
 * SALE_COMPLETED event boundary (Phase 3 → Phase 4).
 *
 * Phase 3 builds the sale record and hands it to the local history. Phase 4
 * replaces the body of this function with the automation engine: inventory
 * deduction, payment records, revenue, customer history, receipt generation,
 * activity events, low-stock checks, notifications, reporting.
 */
export function completeSaleDraft(actor: string): CompletedSaleEvent {
  const draft = store.get();
  if (draft.items.length === 0) {
    return { kind: "error", message: "Add at least one product before completing the sale." };
  }
  if (draft.paymentStatus === "part" && draft.amountPaid <= 0) {
    return { kind: "error", message: "Enter the amount the customer has paid." };
  }
  if (draft.paymentStatus === "part" && draft.amountPaid > saleTotal(draft)) {
    return {
      kind: "error",
      message: "The amount paid is more than the sale total. Adjust it or choose Paid.",
    };
  }

  const sale: CompletedSale = {
    reference: nextSaleReference(),
    items: draft.items,
    subtotal: saleSubtotal(draft),
    discountPercent: draft.discountPercent,
    discountAmount: saleDiscountAmount(draft),
    total: saleTotal(draft),
    customerId: draft.customerId,
    customerName: draft.customerName || "Walk-in Customer",
    customerPhone: draft.customerPhone,
    paymentStatus: draft.paymentStatus,
    method: draft.method,
    amountPaid: draft.paymentStatus === "paid" ? saleTotal(draft) : draft.amountPaid,
    balance: saleBalance(draft),
    employeeName: actor || "Staff",
    employeeId: draft.actorId || "role-preview",
    employeeRole: draft.actorRole,
    businessId: getBusinessInfo().id ?? null,
    completedAt: new Date().toISOString(),
  };

  resetSaleDraft();
  return { kind: "ok", sale };
}

/** Currency formatting for sale UI (business currency). */
export function formatSaleMoney(value: number): string {
  return formatMoney(value, getBusinessInfo().currency || "NGN");
}
