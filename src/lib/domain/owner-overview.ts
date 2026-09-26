"use client";

import { useMemo } from "react";
import { useBusinessMetrics } from "./metrics";
import { useEmployeeTransactions } from "../employee-transactions";
import { useStockMovements } from "./stock-movements";
import { useActivity } from "../activity-store";
import { useProducts } from "../products-store";
import { stockStatus, lowStockThreshold } from "./stock-state";
import { productCostPrice } from "../product-meta";
import { getBusinessInfo } from "../business-store";
import { formatMoneyWhole } from "../currency-symbol";

/**
 * Owner Command Center data (Phase 6).
 *
 * Every figure here is DERIVED from the existing domain stores — Phase 4
 * metrics, the employee transaction history, the Phase 5 movement ledger,
 * and the activity system. No new persistence, no competing calculations:
 * the dashboard reads the same processed events the rest of the app runs on.
 *
 * Period context (spec §24): today-metrics bucket by the LOCAL calendar day
 * of each event; inventory metrics are "current" snapshots.
 */

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* ---------------- Today's KPIs (spec §7–9) ---------------- */

export interface TodayKpis {
  /** Completed sale value today (what customers owe). */
  saleValue: number;
  /** Money actually received today. */
  moneyReceived: number;
  /** Outstanding on today's sales (value − received). */
  outstanding: number;
  /** Completed transactions today. */
  transactions: number;
  /** False when there is no transaction history at all (empty business). */
  hasData: boolean;
}

export function useTodayKpis(): TodayKpis {
  const all = useBusinessMetrics();
  const transactions = useEmployeeTransactions();

  return useMemo(() => {
    const todays = transactions.filter((s) => isToday(s.completedAt));
    const saleValue = todays.reduce((sum, s) => sum + s.total, 0);
    const moneyReceived = todays.reduce((sum, s) => sum + s.amountPaid, 0);
    return {
      saleValue,
      moneyReceived,
      outstanding: Math.max(0, saleValue - moneyReceived),
      transactions: todays.length,
      hasData: all.salesCount > 0,
    };
  }, [transactions, all.salesCount]);
}

/* ---------------- Inventory snapshot (spec §10, §22) ---------------- */

export interface InventoryAttentionProduct {
  id: string;
  name: string;
  stock: number;
  threshold: number;
}

export interface InventorySnapshot {
  totalProducts: number;
  totalUnits: number;
  lowCount: number;
  outCount: number;
  /** Low-stock products, most urgent first (lowest stock). */
  lowProducts: InventoryAttentionProduct[];
  outProducts: InventoryAttentionProduct[];
  /**
   * Inventory value at cost — only meaningful when at least one cost price
   * exists (spec §22). `missing` counts products without a cost price.
   */
  value: { total: number; priced: number; missing: number } | null;
}

export function useInventorySnapshot(): InventorySnapshot {
  const { products } = useProducts();

  return useMemo(() => {
    let totalUnits = 0;
    let lowCount = 0;
    let outCount = 0;
    let value = 0;
    let priced = 0;
    const lowProducts: InventoryAttentionProduct[] = [];
    const outProducts: InventoryAttentionProduct[] = [];

    for (const p of products) {
      totalUnits += p.stock;
      const status = stockStatus(p);
      if (status === "out") {
        outCount += 1;
        outProducts.push({ id: p.id, name: p.name, stock: p.stock, threshold: lowStockThreshold(p) });
      } else if (status === "low") {
        lowCount += 1;
        lowProducts.push({ id: p.id, name: p.name, stock: p.stock, threshold: lowStockThreshold(p) });
      }
      const cost = productCostPrice(p.name);
      if (cost !== null) {
        value += cost * p.stock;
        priced += 1;
      }
    }

    lowProducts.sort((a, b) => a.stock - b.stock);
    outProducts.sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalProducts: products.length,
      totalUnits,
      lowCount,
      outCount,
      lowProducts,
      outProducts,
      value:
        products.length === 0 || priced === 0
          ? null
          : { total: value, priced, missing: products.length - priced },
    };
  }, [products]);
}

/* ---------------- Today's sales preview (spec §18, §19) ---------------- */

export interface TodaySaleRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TodaySalesPreview {
  rows: TodaySaleRow[];
  /** Distinct products sold today. */
  productCount: number;
  totalUnits: number;
  transactionCount: number;
  salesValue: number;
}

export function useTodaySalesPreview(): TodaySalesPreview {
  const transactions = useEmployeeTransactions();

  return useMemo(() => {
    const byProduct = new Map<string, TodaySaleRow>();
    let totalUnits = 0;
    let transactionCount = 0;
    let salesValue = 0;

    for (const sale of transactions) {
      if (!isToday(sale.completedAt)) continue;
      transactionCount += 1;
      salesValue += sale.total;
      for (const item of sale.items) {
        totalUnits += item.quantity;
        const existing = byProduct.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.unitPrice * item.quantity;
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            revenue: item.unitPrice * item.quantity,
          });
        }
      }
    }

    const rows = [...byProduct.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);

    return { rows, productCount: byProduct.size, totalUnits, transactionCount, salesValue };
  }, [transactions]);
}

/* ---------------- BizMate noticed (spec §15) ---------------- */

export interface Observation {
  id: string;
  text: string;
  href: string;
}

export function useObservations(): Observation[] {
  const movements = useStockMovements();
  const transactions = useEmployeeTransactions();
  const { products } = useProducts();

  return useMemo(() => {
    const out: Observation[] = [];
    const seenProducts = new Set<string>();

    // 1) A product hit zero today AND is still out — a live condition.
    for (const m of movements) {
      if (!isToday(m.at)) continue;
      if (m.stockBefore > 0 && m.stockAfter === 0 && !seenProducts.has(m.productId)) {
        const still = products.find((p) => p.id === m.productId);
        if (still && still.stock === 0) {
          seenProducts.add(m.productId);
          out.push({
            id: `obs-out-${m.productId}`,
            text: `${m.productName} stock reached 0 today.`,
            href: `/dashboard/employee/inventory/${m.productId}`,
          });
        }
      }
    }

    // 2) A product dropped below its low-stock level today AND is still low.
    for (const m of movements) {
      if (!isToday(m.at) || seenProducts.has(m.productId)) continue;
      if (m.stockAfter <= 0 || m.stockAfter >= m.stockBefore) continue;
      const product = products.find((p) => p.id === m.productId);
      if (!product) continue;
      const threshold = lowStockThreshold(product);
      if (m.stockBefore > threshold && m.stockAfter <= threshold && product.stock <= threshold) {
        seenProducts.add(m.productId);
        out.push({
          id: `obs-low-${m.productId}`,
          text: `${m.productName} is now below its stock threshold (${product.stock} left).`,
          href: `/dashboard/employee/inventory/${m.productId}`,
        });
      }
    }

    // 3) Outstanding balances on today's transactions.
    const todayOutstanding = transactions
      .filter((s) => isToday(s.completedAt))
      .reduce((sum, s) => sum + Math.max(0, s.balance), 0);
    if (todayOutstanding > 0) {
      out.push({
        id: "obs-outstanding-today",
        text: `${formatMoneyWhole(todayOutstanding, getBusinessInfo().currency || "NGN")} remains outstanding on today's transactions.`,
        href: "/dashboard/employee/transactions",
      });
    }

    return out.slice(0, 3);
  }, [movements, transactions, products]);
}

/* ---------------- Team activity (spec §20) ---------------- */

export interface TeamActivityRow {
  name: string;
  sales: number;
  stockMovements: number;
  customerAdds: number;
}

export function useTeamActivity(): TeamActivityRow[] {
  const activity = useActivity();

  return useMemo(() => {
    const byActor = new Map<string, TeamActivityRow>();
    const touch = (name: string): TeamActivityRow => {
      let row = byActor.get(name);
      if (!row) {
        row = { name, sales: 0, stockMovements: 0, customerAdds: 0 };
        byActor.set(name, row);
      }
      return row;
    };

    for (const e of activity) {
      if (!isToday(e.at)) continue;
      const row = touch(e.actor);
      if (e.kind === "sale_completed") row.sales += 1;
      else if (e.kind === "stock_received" || e.kind === "stock_adjusted") row.stockMovements += 1;
      else if (e.kind === "customer_added") row.customerAdds += 1;
    }

    return [...byActor.values()]
      .filter((r) => r.sales + r.stockMovements + r.customerAdds > 0)
      .sort(
        (a, b) =>
          b.sales + b.stockMovements + b.customerAdds -
          (a.sales + a.stockMovements + a.customerAdds),
      );
  }, [activity]);
}

/* ---------------- Business-wide "today" total for the empty check -------- */

/** True when the business has at least one transaction ever (any day). */
export function useHasAnyTransactions(): boolean {
  const all = useBusinessMetrics();
  return all.salesCount > 0;
}
