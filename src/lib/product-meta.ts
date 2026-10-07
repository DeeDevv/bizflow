import { seedProductExtras } from "./mock-data";

/**
 * Product catalog metadata (Phase 5, pricing extended in Phase 8.5).
 *
 * The extended fields the owner captured in setup — code/model, category,
 * brand, manager pricing (regular price + discount %) — keyed by product
 * name (names survive the local→database id swap). Inventory, New Sale, and
 * Receive Stock all read through here so no page re-derives its own product
 * identity.
 *
 * Demo mode falls back to the seed catalog metadata.
 */

import type { ProductPricing } from "./setup-store";

interface ProductMeta {
  code?: string;
  category?: string;
  brand?: string;
  costPrice?: number | null;
  /** Manager pricing (spec §4): absent = no discount configured. */
  pricing?: ProductPricing | null;
}

function setupExtrasMap(): Record<string, ProductMeta> {
  try {
    const raw = localStorage.getItem("bizmate.setup.v1");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { productExtras?: Record<string, ProductMeta> };
        productExtras?: Record<string, ProductMeta>;
      };
      const map = parsed?.state?.productExtras ?? parsed?.productExtras;
      if (map && Object.keys(map).length > 0) return map;
    }
  } catch {
    // fall through to seed data
  }
  return seedProductExtras as Record<string, ProductMeta>;
}

/** Product code / model, e.g. "AS12TG1"; "—" when unknown. */
export function productCode(name: string): string {
  return setupExtrasMap()[name]?.code ?? "—";
}

/** Category label, e.g. "Air Conditioners"; "" when unknown. */
export function productCategory(name: string): string {
  return setupExtrasMap()[name]?.category ?? "";
}

/** Brand label, e.g. "Hisense"; "" when unknown. */
export function productBrand(name: string): string {
  return setupExtrasMap()[name]?.brand ?? "";
}

/** Cost price the owner entered, if any — null when not captured. */
export function productCostPrice(name: string): number | null {
  const cost = setupExtrasMap()[name]?.costPrice;
  return typeof cost === "number" && cost >= 0 ? cost : null;
}

/* ---------------- Manager pricing (Phase 8.5, spec §4) ---------------- */

/**
 * The manager's pricing for a product; null when none was configured
 * (product sells at its catalog price with no discount).
 */
export function productPricing(name: string): ProductPricing | null {
  const pricing = setupExtrasMap()[name]?.pricing;
  if (!pricing || typeof pricing.regularPrice !== "number") return null;
  const pct =
    typeof pricing.discountPercent === "number" && pricing.discountPercent > 0
      ? Math.min(100, pricing.discountPercent)
      : 0;
  return { regularPrice: pricing.regularPrice, discountPercent: pct };
}

/**
 * ONE final-price calculation (regular price minus discount %, rounded to
 * whole currency units — the seed prices are whole naira). Every view and
 * the sale pipeline use this; nothing re-derives the math.
 */
export function finalUnitPrice(regularPrice: number, discountPercent: number): number {
  const pct = Math.min(100, Math.max(0, discountPercent || 0));
  return Math.round(regularPrice * (1 - pct / 100));
}

/** Discount amount for ONE unit, derived from the same pricing. */
export function discountPerUnit(regularPrice: number, discountPercent: number): number {
  return regularPrice - finalUnitPrice(regularPrice, discountPercent);
}

/** All searchable text for one product, joined (name, code, brand, category). */
export function productSearchText(name: string): string {
  return [name, productCode(name), productBrand(name), productCategory(name)]
    .filter((part) => part && part !== "—")
    .join(" ")
    .toLowerCase();
}
