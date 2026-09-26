"use client";

import { useMemo } from "react";
import { useEmployeeTransactions } from "../employee-transactions";
import type { CompletedSale } from "../employee-sales";
import { useProducts } from "../products-store";
import { useStockMovements } from "./stock-movements";
import type { StockMovement } from "./stock-movements";
import type { Product } from "../types";
import { stockStatus, stockStatusLabel } from "./stock-state";
import type { StockStatus } from "./stock-state";
import { productCode, productCategory } from "../product-meta";
import { getBusinessInfo } from "../business-store";
import { computeInventorySnapshot } from "./owner-overview";

/**
 * End-of-Day Business Report (Phase 7).
 *
 * A DERIVED VIEW of the business state — no new persistence, no competing
 * calculations. The generator consumes the same domain data the rest of the
 * app runs on (Phase 4 transaction history, Phase 5 catalog + stock state,
 * Phase 5 movement ledger) and produces one structured model that any
 * presentation layer can render today (web) or later (print, WhatsApp,
 * email — the model is delivery-agnostic by design).
 *
 * Architecture:
 *   Existing domain data → buildEndOfDayReport() → structured report → UI
 *
 * The report day is the LOCAL calendar day (same bucketing as the Phase 6
 * Command Center) so transactions never land on the wrong day via UTC.
 * Generation is deterministic: same data + same date ⇒ same report. Sorting
 * is fixed — transactions chronological, products grouped by category then
 * name — and no random or speculative content is ever included.
 */

/** True when two instants fall on the same LOCAL calendar day. */
export function isSameLocalDay(a: string | Date, b: string | Date): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export type ReportPaymentMethod = "cash" | "transfer" | "pos" | "other";

const METHOD_LABEL: Record<ReportPaymentMethod, string> = {
  cash: "Cash",
  transfer: "Bank Transfer",
  pos: "POS",
  other: "Other",
};

export function reportMethodLabel(method: ReportPaymentMethod): string {
  return METHOD_LABEL[method];
}

/* ---------------- Structured report model ---------------- */

export interface ReportSaleItem {
  productId: string;
  name: string;
  code: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** One completed transaction, chronological order. */
export interface ReportTransaction {
  reference: string;
  completedAt: string;
  customerName: string;
  employeeName: string;
  paymentStatus: CompletedSale["paymentStatus"];
  method: CompletedSale["method"];
  amountPaid: number;
  balance: number;
  total: number;
  items: ReportSaleItem[];
}

/** Today's sales grouped by product (repeated sales of a product merge). */
export interface ReportProductRow {
  productId: string;
  name: string;
  quantity: number;
  total: number;
}

export type PaymentMethodTotals = Partial<Record<ReportPaymentMethod, number>>;

export type PaymentStatusCount = Partial<
  Record<CompletedSale["paymentStatus"], number>
>;

export interface ReportOutstandingRow {
  reference: string;
  customerName: string;
  productSummary: string;
  amount: number;
}

export interface ReportInventoryRow {
  productId: string;
  name: string;
  code: string;
  category: string;
  stock: number;
  status: StockStatus;
  statusLabel: string;
}

export interface ReportInventoryCategory {
  category: string;
  products: ReportInventoryRow[];
}

export interface ReportStockActivity {
  receivedUnits: number;
  receivedEvents: number;
  soldUnits: number;
  adjustments: number;
  hasAny: boolean;
}

export interface EndOfDayReport {
  generatedAt: string;
  business: { name: string };
  date: { iso: string; label: string; isToday: boolean };
  summary: {
    salesValue: number;
    moneyReceived: number;
    outstanding: number;
    transactionCount: number;
    hasSales: boolean;
  };
  transactions: ReportTransaction[];
  productRows: ReportProductRow[];
  paymentTotals: PaymentMethodTotals;
  paymentStatusCounts: PaymentStatusCount;
  outstanding: ReportOutstandingRow[];
  inventorySummary: {
    totalProducts: number;
    totalUnits: number;
    lowCount: number;
    outCount: number;
    value: { total: number; priced: number; missing: number } | null;
  };
  inventory: ReportInventoryCategory[];
  stockActivity: ReportStockActivity;
}

/* ---------------- Deterministic generator ---------------- */

/** "Saturday, September 26, 2026" for the report header. */
export function formatReportDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build the structured End-of-Day Report for one LOCAL calendar day.
 *
 * Pure and deterministic: it reads only the inputs given, never the clock or
 * the DOM, so the same business data and date always produce the same report.
 * The hook below is the thin React adapter over this function.
 */
export function buildEndOfDayReport(input: {
  businessName: string;
  date: Date;
  transactions: CompletedSale[];
  products: Product[];
  movements: StockMovement[];
}): EndOfDayReport {
  const { businessName, date, transactions, products, movements } = input;

  /* ---- Today's transactions (chronological, oldest first) ---- */
  const dayTransactions = transactions
    .filter((s) => isSameLocalDay(s.completedAt, date))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const transactionsView: ReportTransaction[] = dayTransactions.map((s) => ({
    reference: s.reference,
    completedAt: s.completedAt,
    customerName: s.customerName || "Walk-in Customer",
    employeeName: s.employeeName,
    paymentStatus: s.paymentStatus,
    method: s.method,
    amountPaid: s.amountPaid,
    balance: s.balance,
    total: s.total,
    items: s.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      code: i.code,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.unitPrice * i.quantity,
    })),
  }));

  /* ---- Summary (same definitions as Phase 4/6) ---- */
  const salesValue = dayTransactions.reduce((sum, s) => sum + s.total, 0);
  const moneyReceived = dayTransactions.reduce((sum, s) => sum + s.amountPaid, 0);

  /* ---- Sales grouped by product (ties broken by name) ---- */
  const byProduct = new Map<string, ReportProductRow>();
  for (const sale of dayTransactions) {
    for (const item of sale.items) {
      const existing = byProduct.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.total += item.unitPrice * item.quantity;
      } else {
        byProduct.set(item.productId, {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          total: item.unitPrice * item.quantity,
        });
      }
    }
  }
  const productRows = [...byProduct.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  /* ---- Payment methods + statuses (only what was actually recorded) ---- */
  const paymentTotals: PaymentMethodTotals = {};
  const paymentStatusCounts: PaymentStatusCount = {};
  for (const sale of dayTransactions) {
    if (sale.method) {
      paymentTotals[sale.method] = (paymentTotals[sale.method] ?? 0) + sale.amountPaid;
    }
    paymentStatusCounts[sale.paymentStatus] =
      (paymentStatusCounts[sale.paymentStatus] ?? 0) + 1;
  }

  /* ---- Outstanding balances on the day's transactions ---- */
  const outstanding: ReportOutstandingRow[] = dayTransactions
    .filter((s) => s.balance > 0)
    .map((s) => ({
      reference: s.reference,
      customerName: s.customerName || "Walk-in Customer",
      productSummary: s.items
        .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
        .join(", "),
      amount: s.balance,
    }))
    .sort((a, b) => b.amount - a.amount);

  /* ---- Current stock: the ENTIRE catalogue, not just what sold today ---- */
  const inventoryRows: ReportInventoryRow[] = products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      code: productCode(p.name),
      category: productCategory(p.name),
      stock: p.stock,
      status: stockStatus(p),
      statusLabel: stockStatusLabel[stockStatus(p)],
    }))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );

  const categories = new Map<string, ReportInventoryRow[]>();
  for (const row of inventoryRows) {
    const key = row.category || "Other";
    const list = categories.get(key);
    if (list) list.push(row);
    else categories.set(key, [row]);
  }
  const inventory: ReportInventoryCategory[] = [...categories.entries()]
    .map(([category, list]) => ({ category, products: list }))
    .sort((a, b) => a.category.localeCompare(b.category));

  // Totals, low/out counts and value-at-cost come from the ONE shared
  // inventory calculation (same numbers as Inventory page + Command Center).
  const snapshot = computeInventorySnapshot(products);

  /* ---- Stock activity today (only if the ledger supports it) ---- */
  let receivedUnits = 0;
  let receivedEvents = 0;
  let soldUnits = 0;
  let adjustments = 0;
  for (const m of movements) {
    if (!isSameLocalDay(m.at, date)) continue;
    if (m.kind === "receive") {
      receivedUnits += Math.max(0, m.quantity);
      receivedEvents += 1;
    } else if (m.kind === "sale") {
      soldUnits += Math.max(0, -m.quantity);
    } else if (m.kind === "adjust") {
      adjustments += m.quantity;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    business: { name: businessName },
    date: {
      iso: date.toISOString(),
      label: formatReportDay(date.toISOString()),
      isToday: isSameLocalDay(date, new Date()),
    },
    summary: {
      salesValue,
      moneyReceived,
      outstanding: Math.max(0, salesValue - moneyReceived),
      transactionCount: dayTransactions.length,
      hasSales: dayTransactions.length > 0,
    },
    transactions: transactionsView,
    productRows,
    paymentTotals,
    paymentStatusCounts,
    outstanding,    inventorySummary: {
      totalProducts: snapshot.totalProducts,
      totalUnits: snapshot.totalUnits,
      lowCount: snapshot.lowCount,
      outCount: snapshot.outCount,
      value: snapshot.value,
    },
    inventory,
    stockActivity: {
      receivedUnits,
      receivedEvents,
      soldUnits,
      adjustments,
      hasAny: receivedEvents > 0 || soldUnits > 0 || adjustments !== 0,
    },
  };
}

/* ---------------- React adapter ---------------- */

/**
 * Today's End-of-Day Report from the live domain stores.
 * Memoized on the inputs, so navigation re-renders never re-aggregate.
 * A future historical-date picker passes its own `date` — nothing else
 * changes.
 */
export function useEndOfDayReport(): EndOfDayReport {
  const transactions = useEmployeeTransactions();
  const { products } = useProducts();
  const movements = useStockMovements();

  return useMemo(
    () =>
      buildEndOfDayReport({
        businessName: getBusinessInfo().name || "Your business",
        date: new Date(),
        transactions,
        products,
        movements,
      }),
    [transactions, products, movements],
  );
}
