"use client";

import { createPersistentStore } from "../persistent-store";
import {
  nextSaleReference,
  resetSaleDraft,
  saleBalance,
  saleDiscountAmount,
  saleSubtotal,
  saleTotal,
  type CompletedSale,
  type SaleDraft,
} from "../employee-sales";
import { recordCompletedSale } from "../employee-transactions";
import { recordActivity } from "../activity-store";
import { currentEmployeeName } from "../employee-session";
import type { Product } from "../types";
import { evaluateStockCondition } from "./stock-state";
import { raiseNotification } from "./notifications";
import { recordPurchase } from "./customer-history";
import { applySaleToMetrics } from "./metrics";
import { buildReceiptData, type ReceiptData } from "./receipt";

/**
 * The BizMate automation engine (Phase 4).
 *
 * ONE processing path per business event — UI components never scatter the
 * consequences. Pipeline (spec §4):
 *
 *   Action → Event → Validate → Transaction → Inventory → Payment →
 *   Customer history → Receipt data → Activity → Metrics →
 *   Threshold checks → Notifications
 *
 * Safety model:
 *  - Validation happens BEFORE any mutation; a failed sale changes nothing.
 *  - Idempotency: processed transaction references are recorded, so a
 *    replayed SALE_COMPLETED can never double-deduct or double-pay.
 *  - Persistence adapters are injected (applyStockChange), matching the
 *    UI → Domain service → Repository pattern; the new backend replaces the
 *    adapters with real atomic transactions without touching this logic.
 */

/* ---------------- Idempotency registry ---------------- */

const processedStore = createPersistentStore<string[]>(
  "bizmate.processed-events.v1",
  [],
);

function getProcessedRefs(): string[] {
  return processedStore.get();
}

function isSaleProcessed(ref: string): boolean {
  return getProcessedRefs().includes(ref);
}

function markSaleProcessed(ref: string): void {
  // Keep the registry bounded — recent references are enough for replay
  // protection in the local architecture.
  processedStore.set([ref, ...getProcessedRefs()].slice(0, 200));
}

/** True when a transaction reference has already been processed. */
export function isTransactionProcessed(ref: string): boolean {
  return isSaleProcessed(ref);
}

/* ---------------- SALE_COMPLETED ---------------- */

export interface SaleProcessingInput {
  /** The draft snapshot to process (validated against the live catalog). */
  draft: SaleDraft;
  /** Current catalog snapshot — the stock-safety source of truth. */
  catalog: Product[];
  /** Employee completing the sale (activity/audit attribution). */
  actor: string;
  /**
   * Repository adapter: persists one product's new stock level.
   * Local stores today; a database update in the backend phase.
   */
  applyStockChange: (productId: string, newStock: number) => Promise<void> | void;
}

export type SaleProcessingResult =
  | { kind: "ok"; sale: CompletedSale; receipt: ReceiptData }
  | { kind: "error"; message: string };

function validateDraft(
  draft: SaleDraft,
  catalog: Product[],
): { kind: "error"; message: string } | { kind: "ok"; total: number } {
  if (draft.items.length === 0) {
    return { kind: "error", message: "Add at least one product before completing the sale." };
  }

  const subtotal = saleSubtotal(draft);
  const discount = saleDiscountAmount(draft);
  const total = saleTotal(draft);

  for (const item of draft.items) {
    const product = catalog.find((p) => p.id === item.productId);
    if (!product) {
      return {
        kind: "error",
        message: `${item.name} is no longer in the catalogue. Remove it and search again.`,
      };
    }
    if (!(item.quantity > 0)) {
      return {
        kind: "error",
        message: `Quantity for ${item.name} must be at least 1.`,
      };
    }
    // Stock safety: reject BEFORE any mutation — never partial, never negative.
    if (item.quantity > product.stock) {
      return {
        kind: "error",
        message: `Not enough stock available for ${item.name}. Only ${product.stock} unit${
          product.stock === 1 ? "" : "s"
        } in stock.`,
      };
    }
    if (!(item.unitPrice >= 0) || !Number.isFinite(item.unitPrice)) {
      return {
        kind: "error",
        message: `${item.name} has an invalid price. Remove it and add it again.`,
      };
    }
  }

  if (draft.paymentStatus === "part") {
    if (!(draft.amountPaid > 0)) {
      return { kind: "error", message: "Enter the amount the customer has paid." };
    }
    if (draft.amountPaid >= total) {
      return {
        kind: "error",
        message: "The amount paid covers the full total — choose Paid instead.",
      };
    }
  }

  if (discount < 0 || discount > subtotal) {
    return { kind: "error", message: "The discount is invalid. Adjust it and try again." };
  }

  void subtotal;
  return { kind: "ok", total };
}

/**
 * Process a completed sale through the full pipeline. Returns the processed
 * transaction plus its generated receipt data, or a clear error with the
 * business state untouched.
 */
export async function processSaleCompleted(
  input: SaleProcessingInput,
): Promise<SaleProcessingResult> {
  const { draft, catalog, applyStockChange } = input;

  // 1) Validate — nothing has been mutated yet.
  const validation = validateDraft(draft, catalog);
  if (validation.kind === "error") return validation;

  // 2) Claim the transaction reference (duplicate protection).
  const reference = nextSaleReference();
  if (isSaleProcessed(reference)) {
    return {
      kind: "error",
      message: "This sale was already processed. Start a new sale.",
    };
  }
  markSaleProcessed(reference);

  // 3) Build the transaction from the SAME central calculations the UI used.
  const total = saleTotal(draft);
  const amountPaid =
    draft.paymentStatus === "paid" ? total : draft.paymentStatus === "unpaid" ? 0 : draft.amountPaid;
  const sale: CompletedSale = {
    reference,
    items: draft.items,
    subtotal: saleSubtotal(draft),
    discountPercent: draft.discountPercent,
    discountAmount: saleDiscountAmount(draft),
    total,
    customerId: draft.customerId,
    customerName: draft.customerName || "Walk-in Customer",
    customerPhone: draft.customerPhone,
    paymentStatus: draft.paymentStatus,
    method: draft.method,
    amountPaid,
    balance: saleBalance({ ...draft, amountPaid }),
    employeeName: input.actor || "Staff",
    completedAt: new Date().toISOString(),
  };

  // 4) Inventory: deduct every item (multi-product safe, stock-checked).
  const stockUpdates = draft.items.map((item) => {
    const product = catalog.find((p) => p.id === item.productId)!;
    return { product, newStock: product.stock - item.quantity };
  });
  for (const { product, newStock } of stockUpdates) {
    await applyStockChange(product.id, newStock);
  }

  // 5) Transaction record (employee Transactions view / future reports).
  recordCompletedSale(sale);

  // 6) Customer history (walk-ins never create permanent records).
  if (sale.customerId) {
    recordPurchase({
      saleRef: sale.reference,
      customerId: sale.customerId,
      customerName: sale.customerName,
      items: sale.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      total: sale.total,
      amountPaid: sale.amountPaid,
      balance: sale.balance,
      paymentStatus: sale.paymentStatus,
      at: sale.completedAt,
    });
  }

  // 7) Business metrics: sale value always; money received only what was paid.
  applySaleToMetrics({ total: sale.total, amountPaid: sale.amountPaid });

  // 8) Activity / audit event.
  recordActivity({
    kind: "sale_completed",
    actor: sale.employeeName,
    label: `completed sale ${sale.reference}`,
    saleRef: sale.reference,
    customerId: sale.customerId ?? undefined,
  });

  // 9) Threshold checks → condition notifications (spam-proof: raising an
  //    existing condition updates it instead of duplicating).
  for (const { product, newStock } of stockUpdates) {
    evaluateStockCondition({ ...product, stock: newStock });
  }

  // 10) Outstanding balance on a known customer → owner should know.
  if (sale.balance > 0 && sale.customerId) {
    raiseNotification({
      kind: "outstanding_balance",
      level: "important",
      title: `${sale.customerName} owes ${sale.balance.toLocaleString("en-US")}`,
      detail: `Sale ${sale.reference} has an outstanding balance.`,
      href: "/dashboard/employee/transactions",
      subjectId: sale.reference,
    });
  }

  // 11) Receipt data — structured once, consumed by every receipt view.
  const receipt = buildReceiptData(sale);

  // 12) The draft is consumed.
  resetSaleDraft();

  return { kind: "ok", sale, receipt };
}

/* ---------------- STOCK_RECEIVED ---------------- */

export interface StockReceivedInput {
  product: Product;
  quantity: number;
  /** Actor override (defaults to the current employee session name). */
  actor?: string;
  applyStockChange: (productId: string, newStock: number) => Promise<void> | void;
}

export type StockReceivedResult =
  | { kind: "ok"; newStock: number }
  | { kind: "error"; message: string };

/**
 * Process received stock: increase, activity, and re-evaluate the stock
 * condition (low → normal resolves the low-stock notification).
 */
export async function processStockReceived(
  input: StockReceivedInput,
): Promise<StockReceivedResult> {
  const { product, quantity, applyStockChange } = input;

  if (!product) {
    return { kind: "error", message: "Choose a product to receive stock for." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { kind: "error", message: "Enter the quantity received (at least 1)." };
  }

  const newStock = product.stock + quantity;
  await applyStockChange(product.id, newStock);

  const actor = input.actor || currentEmployeeName();
  recordActivity({
    kind: "stock_received",
    actor,
    label: `received ${quantity} × ${product.name}`,
    productId: product.id,
  });

  // Re-evaluate: low/out conditions resolve when stock returns to normal.
  evaluateStockCondition({ ...product, stock: newStock });

  return { kind: "ok", newStock };
}
