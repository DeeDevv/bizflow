"use client";

/**
 * Supabase data access for the Product Catalog (Phase 5.5).
 * Maps the app's camelCase `Product` onto the `products` table (snake_case):
 *   name → name · price → price · stock → stock · imageUrl → image_url
 * Every row belongs to the business (business_id). No auth yet — the anon
 * policies from migration 0003 allow the app to read and write.
 * UI-agnostic on purpose, same approach as business-db.ts.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Product } from "./types";
import { getBusinessInfo, updateBusinessInfo } from "./business-store";
import { loadBusiness, saveBusiness } from "./business-db";

/** A row from the `products` table, as Supabase returns it. */
interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  price: string | number;
  stock: number;
  image_url: string | null;
}

export type LoadProductsResult =
  | { kind: "ok"; products: Product[] }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

export type MutationResult =
  | { kind: "ok"; product?: Product }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

/** numeric columns arrive as strings from PostgREST — normalize. */
function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    imageUrl: row.image_url ?? "",
  };
}

function toPayload(input: Omit<Product, "id">, businessId: string) {
  return {
    business_id: businessId,
    name: input.name,
    price: input.price,
    stock: input.stock,
    image_url: input.imageUrl || null,
  };
}

/**
 * The database id of the owner business. Ensures a business row exists
 * before products can reference it (creates the profile lazily on first
 * catalog write, so products always attach to the correct business).
 */
export async function ensureBusinessId(): Promise<
  { kind: "ok"; id: string } | { kind: "no-config" } | { kind: "error"; message: string }
> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const cached = getBusinessInfo().id;
  if (cached) return { kind: "ok", id: cached };

  try {
    // The database record is the source of truth: load the existing
    // business instead of writing local (possibly seed/mock) values over
    // it. Only create a row when none exists yet (first run).
    const result = await loadBusiness();
    if (result.kind === "ok" && result.business.id) {
      updateBusinessInfo({ ...result.business });
      return { kind: "ok", id: result.business.id };
    }
    if (result.kind === "empty") {
      // Phase 6: saveBusiness stamps owner_user_id from the authenticated
      // session, so a first-run catalog write creates an owned business
      // instead of an orphan row.
      const created = await saveBusiness(getBusinessInfo());
      if (created.kind !== "ok") return created;
      updateBusinessInfo({ id: created.id });
      return { kind: "ok", id: created.id };
    }
    return result.kind === "error"
      ? result
      : { kind: "error", message: "No business record found." };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Load the business's products, newest first (matches the current list order). */
export async function loadProducts(): Promise<LoadProductsResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("business_id", businessId.id)
      .order("created_at", { ascending: false });

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", products: ((data ?? []) as ProductRow[]).map(rowToProduct) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Create a product for the business and return it with its real database id. */
export async function createProductInDb(
  input: Omit<Product, "id">,
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .insert(toPayload(input, businessId.id))
      .select("*")
      .single();

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", product: rowToProduct(data as ProductRow) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Update an existing product record. */
export async function updateProductInDb(
  id: string,
  input: Omit<Product, "id">,
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .update({
        name: input.name,
        price: input.price,
        stock: input.stock,
        image_url: input.imageUrl || null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", product: rowToProduct(data as ProductRow) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Delete an existing product record. */
export async function deleteProductInDb(id: string): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("products").delete().eq("id", id);
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok" };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Result of an atomic stock change (deduct/restore). */
export type StockMutationResult =
  | { kind: "ok"; newStock: number }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

/**
 * Deduct stock for one product — Phase 5.7 foundation, not called yet.
 *
 * Runs inside the database as ONE atomic check-and-deduct
 * (migration 0005 `deduct_product_stock`), so two invoices completing at
 * the same moment can never both dip into the same units. Fails with a
 * clear message when there is not enough stock; stock can never go
 * below 0 (the column's own CHECK enforces it too).
 */
export async function deductProductStock(
  productId: string,
  quantity: number,
): Promise<StockMutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      kind: "error",
      message: "Quantity to deduct must be a positive whole number.",
    };
  }
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("deduct_product_stock", {
      p_product_id: productId,
      p_quantity: quantity,
    });
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", newStock: Number(data) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/**
 * Add stock back for one product — Phase 5.7 foundation, not called yet.
 * Used when an invoice is edited or reversed so quantities return to
 * inventory (migration 0005 `restore_product_stock`).
 */
export async function restoreProductStock(
  productId: string,
  quantity: number,
): Promise<StockMutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      kind: "error",
      message: "Quantity to restore must be a positive whole number.",
    };
  }
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("restore_product_stock", {
      p_product_id: productId,
      p_quantity: quantity,
    });
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", newStock: Number(data) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
