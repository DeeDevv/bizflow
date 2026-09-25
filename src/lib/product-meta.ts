import { seedProductExtras } from "./mock-data";

/**
 * Product catalog metadata (Phase 5).
 *
 * The extended fields the owner captured in setup — code/model, category,
 * brand — keyed by product name (names survive the local→database id swap).
 * Inventory, New Sale, and Receive Stock all read through here so no page
 * re-derives its own product identity.
 *
 * Demo mode falls back to the seed catalog metadata.
 */

interface ProductMeta {
  code?: string;
  category?: string;
  brand?: string;
  costPrice?: number | null;
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

/** All searchable text for one product, joined (name, code, brand, category). */
export function productSearchText(name: string): string {
  return [name, productCode(name), productBrand(name), productCategory(name)]
    .filter((part) => part && part !== "—")
    .join(" ")
    .toLowerCase();
}
