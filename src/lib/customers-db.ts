"use client";

/**
 * Supabase data access for Customers (Phase 5.6).
 * Maps the app's camelCase `Customer` onto the `customers` table
 * (snake_case): name → name · email → email · phone → phone.
 * Every row belongs to the business (business_id). No auth yet — the anon
 * policies from migration 0004 allow the app to read and write.
 * UI-agnostic on purpose, same approach as business-db.ts / products-db.ts.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { Customer } from "./types";
import { ensureBusinessId } from "./products-db";

/** A row from the `customers` table, as Supabase returns it. */
interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string | null;
}

export type LoadCustomersResult =
  | { kind: "ok"; customers: Customer[] }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

export type MutationResult =
  | { kind: "ok"; customer?: Customer }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
  };
}

function toPayload(
  input: { name: string; email: string; phone: string },
  businessId: string,
) {
  return {
    business_id: businessId,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
  };
}

/** Load the business's customers, newest first (matches the current list order). */
export async function loadCustomers(): Promise<LoadCustomersResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("customers")
      .select("*")
      .eq("business_id", businessId.id)
      .order("created_at", { ascending: false });

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", customers: ((data ?? []) as CustomerRow[]).map(rowToCustomer) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Create a customer for the business and return it with its real database id. */
export async function createCustomerInDb(
  input: { name: string; email: string; phone: string },
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };

  const businessId = await ensureBusinessId();
  if (businessId.kind !== "ok") return businessId;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("customers")
      .insert(toPayload(input, businessId.id))
      .select("*")
      .single();

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", customer: rowToCustomer(data as CustomerRow) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Update an existing customer record. */
export async function updateCustomerInDb(
  id: string,
  input: { name: string; email: string; phone: string },
): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("customers")
      .update({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", customer: rowToCustomer(data as CustomerRow) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/** Delete an existing customer record. */
export async function deleteCustomerInDb(id: string): Promise<MutationResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("customers").delete().eq("id", id);
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok" };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
