import type { Product } from "./types";
import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";

/**
 * Employee inventory helpers (Phase 3).
 *
 * Stock status uses the owner's low-stock thresholds where they exist
 * (setup productExtras, keyed by product name) with a sensible default (≤5)
 * matching the owner-side attention rules.
 */

/** Stock received by inventory staff this session (mock, Phase 3). */
export interface StockReceipt {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  at: string;
  actor: string;
}

const receiptsStore = createPersistentStore<StockReceipt[]>(
  "bizmate.stock-receipts.v1",
  [],
);

export function recordStockReceipt(entry: Omit<StockReceipt, "id" | "at">): StockReceipt {
  const full: StockReceipt = {
    id: `rcv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  receiptsStore.set([full, ...receiptsStore.get()]);
  return full;
}

export function useStockReceipts(): StockReceipt[] {
  return useSyncExternalStore(
    receiptsStore.subscribe,
    () => receiptsStore.get(),
    () => [],
  );
}

export type StockStatus = "out" | "low" | "in";

export function lowStockThreshold(product: Product): number {
  // Read the setup store snapshot directly (its persistent cache).
  try {
    const raw = localStorage.getItem("bizmate.setup.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { productExtras?: Record<string, { lowStockAt?: number }> };
        productExtras?: Record<string, { lowStockAt?: number }>;
      };
      const extrasMap = parsed?.state?.productExtras ?? parsed?.productExtras;
      const threshold = extrasMap?.[product.name]?.lowStockAt;
      if (typeof threshold === "number" && threshold > 0) return threshold;
    }
  } catch {
    // ignore malformed cache; fall back to the default below
  }
  // Demo mode fallback: the LG refrigerator is seeded low on purpose.
  return product.stock <= 5 ? 5 : 0;
}

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
