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
import { recordCompletedSale, updateCompletedSale } from "../employee-transactions";
import { recordActivity } from "../activity-store";
import { currentEmployeeId, currentEmployeeName } from "../employee-session";
import { getBusinessInfo } from "../business-store";
import type { Product } from "../types";
import { evaluateStockCondition } from "./stock-state";
import { raiseNotification, resolveNotification } from "./notifications";
import { recordPurchase } from "./customer-history";
import { applySaleToMetrics, applyPaymentToMetrics } from "./metrics";
import { buildReceiptData, type ReceiptData } from "./receipt";
import { recordStockMovement } from "./stock-movements";
import { requireCapability, type Actor } from "./permissions";
import { PermissionError } from "./permissions";
import {
  scheduleFollowUpsForSale,
  scheduleFollowUpForPendingOrder,
  completePendingOrderFollowUp,
} from "./follow-ups";
import {
  recordPaymentEvent,
  laterPaymentsTotal,
  paymentsForSale,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "./payment-events";

/**
 * The BizMate automation engine (Phase 4, hardened in Phase 8.5).
 *
 * ONE processing path per business event — UI components never scatter the
 * consequences. Pipeline (spec §5):
 *
 *   Action → Event → Validate → [Permission gate] → Transaction → Inventory
 *   → Payment → Customer history → Follow-ups → Receipt data → Activity →
 *   Metrics → Threshold checks → Notifications → Reports
 *
 * Phase 8.5 hardening:
 *  - Role permissions are enforced HERE, not just in the UI (spec §16):
 *    requireCapability throws before any mutation on a disallowed action.
 *  - Transactions snapshot per-item pricing (regular price, discount %,
 *    discount amount, final unit price) — later product edits never
 *    rewrite history (spec §4).
 *  - Payments are EVENTS (spec §6): partial payment at sale time is
 *    recorded as one event; later payments append more events. A sale's
 *    paid/balance are always derived from total received, so history is
 *    never overwritten.
 *  - Follow-ups are scheduled by rule after each sale / pending order
 *    (spec §10); settling a balance completes the collection follow-up.
 *  - Stock received is aggregated into ONE "New Inventory Added"
 *    notification per actor+hour — not per item (spec §12).
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

/* ---------------- Attribution ---------------- */

/**
 * Resolve the acting identity for engine calls (spec §2): a stable id, a
 * display name, and the operational role — stamped onto every transaction,
 * activity entry and payment.
 */
export function resolveActor(actor?: Partial<Actor>): Actor {
  return {
    userId: actor?.userId || currentEmployeeId(),
    name: actor?.name || currentEmployeeName(),
    operationalRole: actor?.operationalRole ?? "employee",
  };
}

function businessId(): string | null {
  return getBusinessInfo().id ?? null;
}

/* ---------------- SALE_COMPLETED ---------------- */

export interface SaleProcessingInput {
  /** The draft snapshot to process (validated against the live catalog). */
  draft: SaleDraft;
  /** Current catalog snapshot — the stock-safety source of truth. */
  catalog: Product[];
  /**
   * The acting identity (spec §2). Defaults to the current employee
   * session; the operational role drives the permission gate.
   */
  actor?: Partial<Actor>;
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
  const actor = resolveActor(input.actor);

  // 0) Permission gate (spec §16): only actors with completeSale may sell.
  try {
    requireCapability(actor, "completeSale");
  } catch (err) {
    return permissionError(err);
  }

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
  //    Every item keeps its frozen pricing snapshot (spec §4).
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
    employeeName: actor.name || "Staff",
    employeeId: actor.userId,
    employeeRole: actor.operationalRole,
    businessId: businessId(),
    completedAt: new Date().toISOString(),
  };

  // 4) Inventory: deduct every item (multi-product safe, stock-checked).
  const stockUpdates = draft.items.map((item) => {
    const product = catalog.find((p) => p.id === item.productId)!;
    return { product, quantity: item.quantity, newStock: product.stock - item.quantity };
  });
  for (const { product, quantity, newStock } of stockUpdates) {
    await applyStockChange(product.id, newStock);
    // Movement ledger: traceable stock trail (sale → reference).
    recordStockMovement({
      kind: "sale",
      productId: product.id,
      productName: product.name,
      quantity: -quantity,
      stockBefore: product.stock,
      stockAfter: newStock,
      actor: sale.employeeName,
      reference: sale.reference,
    });
  }

  // 5) Transaction record (employee Transactions view / future reports).
  recordCompletedSale(sale);

  // 5b) Payment event (spec §6): money received at sale time is event #1.
  if (amountPaid > 0 && draft.method) {
    recordPaymentEvent({
      saleRef: sale.reference,
      amount: amountPaid,
      method: draft.method,
      note: null,
      recordedBy: sale.employeeName,
    });
  }

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

  // 6b) Follow-up automation (spec §10): rule-scheduled, idempotent.
  scheduleFollowUpsForSale({
    saleRef: sale.reference,
    customerId: sale.customerId,
    customerName: sale.customerName,
    productSummary: sale.items
      .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
      .join(", "),
    sellerName: sale.employeeName,
    at: sale.completedAt,
  });
  if (sale.balance > 0) {
    scheduleFollowUpForPendingOrder({
      saleRef: sale.reference,
      customerId: sale.customerId,
      customerName: sale.customerName,
      productSummary: sale.items
        .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
        .join(", "),
      sellerName: sale.employeeName,
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
      severity: "warning",
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

/* ---------------- PAYMENT_RECORDED (later payments, spec §6) ---------------- */

export interface PaymentInput {
  /** The transaction to pay against. */
  sale: CompletedSale;
  amount: number;
  method: PaymentMethod;
  note?: string;
  /** Actor override; defaults to the current employee session. */
  actor?: Partial<Actor>;
}

export type PaymentResult =
  | { kind: "ok"; amountPaid: number; balance: number; settled: boolean }
  | { kind: "error"; message: string };

/**
 * Record a LATER payment against an existing transaction (the "₦600,000
 * balance" moment in spec §6). Appends a payment event — never overwrites —
 * updates the transaction's derived status, and completes the pending-order
 * collection follow-up when the balance reaches zero.
 */
export async function recordPaymentOnSale(input: PaymentInput): Promise<PaymentResult> {
  const actor = resolveActor(input.actor);

  // Permission gate: recording payments is employee/manager work (spec §16).
  try {
    requireCapability(actor, "recordPayment");
  } catch (err) {
    return permissionError(err);
  }

  const { sale } = input;
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) {
    return { kind: "error", message: "Enter the amount the customer paid." };
  }
  if (sale.balance <= 0) {
    return { kind: "error", message: "This transaction is already fully paid." };
  }
  if (amount > sale.balance) {
    return {
      kind: "error",
      message: `The payment exceeds the outstanding balance of ${sale.balance.toLocaleString("en-US")}.`,
    };
  }

  // 1) The payment EVENT — history preserved individually (spec §6).
  recordPaymentEvent({
    saleRef: sale.reference,
    amount,
    method: input.method,
    note: input.note?.trim() || null,
    recordedBy: actor.name || "Staff",
  });

  // 2) Derived totals: sale-time payment + every later event, summed.
  const laterTotal = laterPaymentsTotal(sale.reference);
  const totalPaid = sale.amountPaid + laterTotal;
  const balance = Math.max(0, Math.round((sale.total - totalPaid) * 100) / 100);
  const settled = balance <= 0;

  // 3) Update the transaction record in place (amounts only — history
  //    remains in the events; the sale row reflects the current state).
  updateSaleFinancials(sale.reference, {
    amountPaid: totalPaid,
    balance,
    paymentStatus: settled ? "paid" : "part",
    method: sale.method ?? input.method,
  });

  // 4) Metrics: money actually received grows by this payment.
  applyPaymentToMetrics(amount);

  // 5) Activity + outstanding notification resolution.
  recordActivity({
    kind: "payment_recorded",
    actor: actor.name || "Staff",
    label: `recorded ${PAYMENT_METHOD_LABEL[input.method].toLowerCase()} payment on ${sale.reference}`,
    saleRef: sale.reference,
    customerId: sale.customerId ?? undefined,
  });
  if (settled) {
    resolveNotification("outstanding_balance", sale.reference);
    completePendingOrderFollowUp(sale.reference);
  }

  return { kind: "ok", amountPaid: totalPaid, balance, settled };
}

function updateSaleFinancials(
  ref: string,
  patch: { amountPaid: number; balance: number; paymentStatus: "paid" | "part" | "unpaid"; method: CompletedSale["method"] },
): void {
  updateCompletedSale(ref, patch);
}

/* ---------------- STOCK_RECEIVED ---------------- */

export interface StockReceivedInput {
  product: Product;
  quantity: number;
  /** Actor override (defaults to the current employee session). */
  actor?: Partial<Actor>;
  applyStockChange: (productId: string, newStock: number) => Promise<void> | void;
}

export type StockReceivedResult =
  | { kind: "ok"; newStock: number }
  | { kind: "error"; message: string };

/**
 * Aggregation window key for "New Inventory Added" (spec §12): one notice
 * per actor per clock-hour, refreshed in place instead of re-raised.
 */
const inventoryAggStore = createPersistentStore<{ key: string; products: number; units: number; at: string }>(
  "bizmate.inventory-notice.v1",
  { key: "", products: 0, units: 0, at: "" },
);

function raiseNewInventoryNotice(actorName: string, products: number, units: number): void {
  const hourKey = `${new Date().toISOString().slice(0, 13)}:${actorName}`;
  const agg = inventoryAggStore.get();
  if (agg.key === hourKey) {
    // Same actor, same hour → refresh ONE aggregate notice.
    inventoryAggStore.set({ ...agg, products: agg.products + products, units: agg.units + units });
    raiseNotification({
      kind: "new_inventory",
      severity: "info",
      title: "New Inventory Added",
      detail: `${actorName} · ${agg.products + products} products updated · ${agg.units + units} units registered`,
      href: "/dashboard/employee/inventory",
      subjectId: `inventory-${hourKey}`,
    });
    return;
  }
  inventoryAggStore.set({ key: hourKey, products, units, at: new Date().toISOString() });
  raiseNotification({
    kind: "new_inventory",
    severity: "info",
    title: "New Inventory Added",
    detail: `${actorName} · ${products} products updated · ${units} units registered`,
    href: "/dashboard/employee/inventory",
    subjectId: `inventory-${hourKey}`,
  });
}

/**
 * Process received stock: increase, activity, and re-evaluate the stock
 * condition (low → normal resolves the low-stock notification). Manager
 * or employee role required (spec §16).
 */
export async function processStockReceived(
  input: StockReceivedInput,
): Promise<StockReceivedResult> {
  const { product, quantity, applyStockChange } = input;
  const actor = resolveActor(input.actor);

  try {
    requireCapability(actor, "receiveStock");
  } catch (err) {
    return permissionError(err);
  }

  if (!product) {
    return { kind: "error", message: "Choose a product to receive stock for." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { kind: "error", message: "Enter the quantity received (at least 1)." };
  }

  const newStock = product.stock + quantity;
  await applyStockChange(product.id, newStock);

  const actorName = actor.name || "Staff";
  recordStockMovement({
    kind: "receive",
    productId: product.id,
    productName: product.name,
    quantity,
    stockBefore: product.stock,
    stockAfter: newStock,
    actor: actorName,
  });
  recordActivity({
    kind: "stock_received",
    actor: actorName,
    label: `received ${quantity} × ${product.name}`,
    productId: product.id,
  });

  // Re-evaluate: low/out conditions resolve when stock returns to normal.
  evaluateStockCondition({ ...product, stock: newStock });

  // Aggregated "New Inventory Added" notice (spec §12) — info severity.
  raiseNewInventoryNotice(actorName, 1, quantity);

  return { kind: "ok", newStock };
}

/* ---------------- STOCK_ADJUSTED ---------------- */

export const ADJUSTMENT_REASONS = [
  "Damaged",
  "Missing",
  "Correction",
  "Return",
  "Counting error",
  "Other",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export interface StockAdjustedInput {
  product: Product;
  /** Signed delta: negative = shrinkage (damaged/missing), positive = found stock. */
  delta: number;
  reason: AdjustmentReason;
  note?: string;
  actor?: Partial<Actor>;
  applyStockChange: (productId: string, newStock: number) => Promise<void> | void;
}

export type StockAdjustedResult =
  | { kind: "ok"; newStock: number }
  | { kind: "error"; message: string };

/**
 * Process an authorized stock adjustment (spec §15/§16): reason is REQUIRED,
 * MANAGER-level only (spec §1: the manager keeps data accurate), stock can
 * never go below zero, everything is validated before mutation, and the
 * movement lands in the ledger with full attribution.
 */
export async function processStockAdjusted(
  input: StockAdjustedInput,
): Promise<StockAdjustedResult> {
  const { product, delta, reason, note, applyStockChange } = input;
  const actor = resolveActor(input.actor);

  // Permission gate: adjustments change the books — manager/owner only.
  try {
    requireCapability(actor, "adjustStock");
  } catch (err) {
    return permissionError(err);
  }

  if (!product) {
    return { kind: "error", message: "Choose a product to adjust." };
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return { kind: "error", message: "Enter the adjustment quantity (not zero)." };
  }
  if (!reason) {
    return { kind: "error", message: "Choose a reason for this adjustment." };
  }

  const newStock = product.stock + delta;
  if (newStock < 0) {
    return {
      kind: "error",
      message: `Adjustment rejected — stock cannot go below zero. Only ${product.stock} in stock.`,
    };
  }

  await applyStockChange(product.id, newStock);

  const actorName = actor.name || "Staff";
  const reference = `ADJ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  recordStockMovement({
    kind: "adjust",
    productId: product.id,
    productName: product.name,
    quantity: delta,
    stockBefore: product.stock,
    stockAfter: newStock,
    actor: actorName,
    reason,
    note: note || undefined,
    reference,
  });
  recordActivity({
    kind: "stock_adjusted",
    actor: actorName,
    label: `adjusted ${product.name} by ${delta > 0 ? "+" : ""}${delta} (${reason.toLowerCase()})`,
    productId: product.id,
  });

  // Adjustment may push a product into/out of a low or out condition.
  evaluateStockCondition({ ...product, stock: newStock });

  return { kind: "ok", newStock };
}

/* ---------------- Permission errors ---------------- */

function permissionError(err: unknown): { kind: "error"; message: string } {
  if (err instanceof PermissionError) {
    return { kind: "error", message: err.message };
  }
  throw err;
}

/** Payments on one sale, for views (Operations Center / receipt history). */
export function paymentHistoryFor(saleRef: string) {
  return paymentsForSale(saleRef);
}
