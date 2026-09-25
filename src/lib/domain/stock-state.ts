import type { Product } from "../types";
import { raiseNotification, resolveNotification } from "./notifications";

/**
 * Stock state (Phase 4) — the ONE source for thresholds and status.
 *
 * Threshold rules:
 *   stock === 0                → out of stock
 *   stock ≤ lowStockThreshold  → low stock
 *   otherwise                  → in stock
 *
 * Transition handling (anti-spam, spec §17):
 *   normal → low    : raise ONE low_stock notification
 *   low → low       : update the existing notification (no new alert)
 *   low → out       : resolve low, raise out_of_stock
 *   anything → normal (restock): resolve both conditions
 *
 * The threshold lookup reads the owner's setup-time low-stock levels
 * (productExtras keyed by product name) with a sensible default (5) that
 * matches the owner-side attention rules.
 */

export type StockStatus = "out" | "low" | "in";

const DEFAULT_LOW_THRESHOLD = 5;

interface ExtrasMap {
  state?: { productExtras?: Record<string, { lowStockAt?: number }> };
  productExtras?: Record<string, { lowStockAt?: number }>;
}

function thresholdMap(): Record<string, { lowStockAt?: number }> {
  try {
    const raw = localStorage.getItem("bizmate.setup.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as ExtrasMap;
      return parsed?.state?.productExtras ?? parsed?.productExtras ?? {};
    }
  } catch {
    // fall through to the default threshold
  }
  return {};
}

/** The owner's low-stock level for a product; default when unset. */
export function lowStockThreshold(product: Product): number {
  const threshold = thresholdMap()[product.name]?.lowStockAt;
  return typeof threshold === "number" && threshold > 0 ? threshold : DEFAULT_LOW_THRESHOLD;
}

/** The ONE status calculation every UI consumes. */
export function stockStatus(product: Product): StockStatus {
  if (product.stock <= 0) return "out";
  if (product.stock <= lowStockThreshold(product)) return "low";
  return "in";
}

export const stockStatusLabel: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Low stock",
  in: "In stock",
};

/** React hook version for components. */
export function useStockStatus(product: Product): StockStatus {
  return stockStatus(product);
}

/**
 * Re-evaluate a product's stock state after any change and raise/resolve
 * notifications accordingly. Called by the automation engine — not by UI.
 */
export function evaluateStockCondition(product: Product): StockStatus {
  const status = stockStatus(product);
  if (status === "low") {
    raiseNotification({
      kind: "low_stock",
      level: "important",
      title: `${product.name} is running low`,
      detail: `Only ${product.stock} left in stock.`,
      href: "/dashboard/employee/inventory",
      subjectId: product.id,
    });
  } else if (status === "out") {
    // Out supersedes low: resolve the low condition, raise out-of-stock.
    resolveNotification("low_stock", product.id);
    raiseNotification({
      kind: "out_of_stock",
      level: "important",
      title: `${product.name} is out of stock`,
      detail: "Restock before selling more of this product.",
      href: "/dashboard/employee/receive-stock",
      subjectId: product.id,
    });
  } else {
    // Back to normal: clear any lingering conditions.
    resolveNotification("low_stock", product.id);
    resolveNotification("out_of_stock", product.id);
  }
  return status;
}
