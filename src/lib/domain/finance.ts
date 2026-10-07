"use client";

import { useMemo } from "react";
import { useStockMovements, type StockMovement } from "./stock-movements";
import { useProducts } from "../products-store";

/**
 * FINANCE MODULE (Phase 8.6, spec §2/§16) — the ONE source of truth for
 * every money/stock-value calculation BizMate performs.
 *
 *   SOURCE DATA (things that happened)          → the stock-movement ledger
 *     receive: quantity + cost per unit (cost batches, spec §6)
 *              + selling price recorded at receive time
 *     sale:    negative quantity + actual selling price charged
 *
 *   CALCULATED DATA (derived here, never stored) → this module
 *     inventory cost value — remaining batch cost (FIFO, spec §6)
 *     potential sales/profit — stock on hand × latest recorded price
 *     revenue / COGS / gross profit — from real sales only (spec §5:
 *     profit is based on the SALE, never on the amount paid so far)
 *     per-product profitability rows (spec §8)
 *
 * Cost-basis model (spec §6 — deliberately simple, no accounting ledger):
 *   the oldest received batches sell first. Each receipt keeps its own
 *   unit cost, so January's ₦320,000 stock never becomes March's ₦350,000.
 *   A sale consumes batches in receive order; the consumed cost at the
 *   price charged is its gross profit. Partial payment does NOT affect
 *   any of this — payment status lives in the transactions store.
 *
 * Missing cost/price on a movement (legacy rows before Phase 8.6) is
 * treated as zero, never hidden or invented.
 *
 * Deliberately NOT here (spec §18): double-entry, depreciation, equity
 * accounts, or any full accounting system. Integrators only — UI, reports
 * and dashboards call these functions instead of recalculating on their own.
 */

/* ------------------------------- Types ---------------------------------- */

/** One remaining cost batch in FIFO order (oldest first). */
export interface CostBatch {
  /** Units still on hand from this receipt. */
  qty: number;
  /** Cost per unit recorded when this batch was received. */
  unitCost: number;
  /** When the batch was received (ISO) — for debugging/inspection. */
  at: string;
}

/** Per-product state produced by replaying the ledger. */
export interface ProductLedgerState {
  productId: string;
  name: string;
  /** Remaining batches, oldest receive first. */
  batches: CostBatch[];
  /** Revenue from actual sales (units × price charged), all time. */
  revenue: number;
  /** Cost of goods sold realized by those sales, all time. */
  cogs: number;
  /** Total units sold, all time. */
  soldUnits: number;
  /**
   * Latest selling price BizMate has seen for this product: the price set
   * at the most recent receipt, else the price of the last sale. null
   * when the ledger has no price yet.
   */
  latestPrice: number | null;
}

/* ---------------------------- Ledger replay ------------------------------ */

function byTime(a: StockMovement, b: StockMovement): number {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
}

function amount(m: StockMovement | undefined, key: "unitCost" | "unitPrice"): number {
  const v = m?.[key];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Replay the movement ledger oldest-first, product by product. Pure: same
 * movements in, same result out — every caller sees identical numbers.
 */
export function replayLedger(movements: StockMovement[]): Map<string, ProductLedgerState> {
  const states = new Map<string, ProductLedgerState>();

  const stateOf = (m: { productId: string; productName: string }): ProductLedgerState => {
    let s = states.get(m.productId);
    if (!s) {
      s = {
        productId: m.productId,
        name: m.productName,
        batches: [],
        revenue: 0,
        cogs: 0,
        soldUnits: 0,
        latestPrice: null,
      };
      states.set(m.productId, s);
    }
    return s;
  };

  /** FIFO-consume n units from the oldest batches, returning realized COGS. */
  const consume = (s: ProductLedgerState, n: number): number => {
    let cogs = 0;
    for (const batch of s.batches) {
      if (n <= 0) break;
      if (batch.qty <= 0) continue;
      const take = Math.min(batch.qty, n);
      batch.qty -= take;
      n -= take;
      cogs += take * batch.unitCost;
    }
    return cogs;
  };

  for (const m of [...movements].sort(byTime)) {
    const s = stateOf(m);
    s.name = m.productName;

    if (m.kind === "receive") {
      // A receipt opens a batch remembering its own cost (spec §6) and —
      // when given — the selling price at receive time.
      s.batches.push({ qty: m.quantity, unitCost: amount(m, "unitCost"), at: m.at });
      s.latestPrice = typeof m.unitPrice === "number" && m.unitPrice >= 0 ? m.unitPrice : s.latestPrice;
    } else if (m.kind === "sale") {
      // A sale moves stock OUT at the price actually charged. Gross profit
      // (spec §5) is realized now — payment status never enters this math.
      const units = -m.quantity;
      if (units <= 0) continue;
      s.soldUnits += units;
      s.revenue += units * amount(m, "unitPrice");
      s.cogs += consume(s, units);
      s.latestPrice = typeof m.unitPrice === "number" && m.unitPrice >= 0 ? m.unitPrice : s.latestPrice;
    } else {
      // "adjust": physical correction, not trade — no revenue, no COGS.
      // Shrinkage consumes batches cost-free (the stock simply leaves);
      // found stock enters as a zero-cost batch.
      if (m.quantity > 0) {
        s.batches.push({ qty: m.quantity, unitCost: 0, at: m.at });
      } else if (m.quantity < 0) {
        consume(s, -m.quantity);
      }
    }
  }

  return states;
}

/** Stock on hand and its cost, straight from the batches. */
function onHand(s: ProductLedgerState): { units: number; cost: number } {
  let units = 0;
  let cost = 0;
  for (const b of s.batches) {
    if (b.qty > 0) {
      units += b.qty;
      cost += b.qty * b.unitCost;
    }
  }
  return { units, cost };
}

/* -------------------------- Business-wide totals ------------------------- */

export interface FinanceTotals {
  /** Value of stock on hand, at the recorded batch cost (spec §7). */
  inventoryCostValue: number;
  /** Stock on hand × latest recorded selling price (spec §4). */
  potentialSales: number;
  /** potentialSales − inventoryCostValue. NEVER shown as earned money. */
  potentialProfit: number;
  /** Revenue from actual completed sales, all time (spec §5). */
  revenue: number;
  /** Realized FIFO cost of goods sold for those sales. */
  cogs: number;
  /** revenue − cogs. Earned — distinct from potential profit (spec §10). */
  grossProfit: number;
  /** Total units on hand, all products (ledger-derived). */
  unitsOnHand: number;
  /** Products with at least one unit on hand. */
  stockedProducts: number;
}

/** Optional catalog fallback: selling price by product id for products the
 * ledger has no price for (e.g. received before Phase 8.6). */
export type PriceFallback = Record<string, number | undefined>;

function priced(s: ProductLedgerState, fallback: PriceFallback): number {
  if (s.latestPrice !== null) return s.latestPrice;
  const fb = fallback[s.productId];
  return typeof fb === "number" && fb >= 0 ? fb : 0;
}

/**
 * One call returns every business-wide calculated finance figure. Any two
 * views calling it with the same ledger display the same numbers.
 */
export function computeFinanceTotals(
  movements: StockMovement[],
  fallbackPrices: PriceFallback = {},
): FinanceTotals {
  const states = replayLedger(movements);
  let inventoryCostValue = 0;
  let potentialSales = 0;
  let revenue = 0;
  let cogs = 0;
  let unitsOnHand = 0;
  let stockedProducts = 0;

  for (const s of states.values()) {
    const { units, cost } = onHand(s);
    if (units > 0) {
      stockedProducts += 1;
      inventoryCostValue += cost;
      potentialSales += units * priced(s, fallbackPrices);
      unitsOnHand += units;
    }
    revenue += s.revenue;
    cogs += s.cogs;
  }

  return {
    inventoryCostValue,
    potentialSales,
    potentialProfit: potentialSales - inventoryCostValue,
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    unitsOnHand,
    stockedProducts,
  };
}

/* ------------------------ Per-product profitability ---------------------- */

export interface ProductProfitRow {
  productId: string;
  name: string;
  /** Units sold, all time (spec §8). */
  soldUnits: number;
  /** Actual sale revenue, all time. */
  revenue: number;
  /** Realized FIFO cost of the sold units. */
  cogs: number;
  /** revenue − cogs. Earned money. */
  grossProfit: number;
  /** grossProfit / revenue (0–1); 0 when nothing sold. */
  margin: number;
  /** Units on hand. */
  stockOnHand: number;
  /** Cost of the stock on hand. */
  stockCost: number;
  /** Potential profit on remaining stock (spec §10 — clearly labeled). */
  potentialProfit: number;
}

/**
 * Per-product profitability table (spec §8), oldest-ledger accurate.
 * Rows come only from products present in the movement ledger.
 */
export function computeProductProfitability(
  movements: StockMovement[],
  fallbackPrices: PriceFallback = {},
): ProductProfitRow[] {
  const states = replayLedger(movements);
  const rows: ProductProfitRow[] = [];

  for (const s of states.values()) {
    const { units, cost } = onHand(s);
    const potentialProfit = units * priced(s, fallbackPrices) - cost;
    rows.push({
      productId: s.productId,
      name: s.name,
      soldUnits: s.soldUnits,
      revenue: s.revenue,
      cogs: s.cogs,
      grossProfit: s.revenue - s.cogs,
      margin: s.revenue > 0 ? (s.revenue - s.cogs) / s.revenue : 0,
      stockOnHand: units,
      stockCost: cost,
      potentialProfit,
    });
  }

  // Most-recent activity first, so the most interesting products float up.
  rows.sort((a, b) => b.revenue - a.revenue || b.soldUnits - a.soldUnits || a.name.localeCompare(b.name));
  return rows;
}

/* ------------------------------- Insights -------------------------------- */

export interface FinanceInsights {
  bestSeller: ProductProfitRow | null;
  mostProfitable: ProductProfitRow | null;
}

/** Simple headline insights (spec §8) — computed, never stored. */
export function computeInsights(rows: ProductProfitRow[]): FinanceInsights {
  let bestSeller: ProductProfitRow | null = null;
  let mostProfitable: ProductProfitRow | null = null;
  for (const r of rows) {
    if (r.soldUnits > 0 && (bestSeller === null || r.soldUnits > bestSeller.soldUnits)) {
      bestSeller = r;
    }
    if (r.grossProfit > 0 && (mostProfitable === null || r.grossProfit > mostProfitable.grossProfit)) {
      mostProfitable = r;
    }
  }
  return { bestSeller, mostProfitable };
}

/* ------------------------- React adapters (thin) ------------------------- */

/** Selling prices of the current product catalog, for ledger-price fallback. */
function useCatalogPrices(): PriceFallback {
  const { products } = useProducts();
  const map: PriceFallback = {};
  for (const p of products) map[p.id] = p.price;
  return map;
}

/** Finance totals for the whole business, live from the ledger. */
export function useFinanceTotals(): FinanceTotals {
  const movements = useStockMovements();
  const prices = useCatalogPrices();
  return useMemo(
    () => computeFinanceTotals(movements, prices),
    [movements, prices],
  );
}

/** Per-product profitability rows, live from the ledger. */
export function useProductProfitability(): ProductProfitRow[] {
  const movements = useStockMovements();
  const prices = useCatalogPrices();
  return useMemo(
    () => computeProductProfitability(movements, prices),
    [movements, prices],
  );
}

/** Best-selling / most-profitable headline insights, live from the ledger. */
export function useFinanceInsights() {
  const rows = useProductProfitability();
  return useMemo(() => computeInsights(rows), [rows]);
}
