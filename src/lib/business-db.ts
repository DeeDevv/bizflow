"use client";

/**
 * Supabase data access for the Business Setup form (Phase 5.4, auth-aware
 * since Phase 6). Maps the app's camelCase `BusinessInfo` onto the
 * `businesses` table (snake_case).
 *
 * Ownership (Phase 6): the database's RLS policies only return rows where
 * `owner_user_id = auth.uid()`, so "load the current business" now means
 * "load the authenticated user's business". On first run a brand-new user
 * creates their business with owner_user_id stamped from their session; the
 * one legacy business from the pre-auth development phase is adopted via the
 * `claim_legacy_business` function instead of being duplicated.
 */

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { BusinessInfo } from "./types";

/** A row from the `businesses` table, as Supabase returns it. */
interface BusinessRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  whatsapp: string | null;
  currency: string;
  logo_url: string | null;
  discounts_enabled: boolean;
  website_url: string | null;
  owner_user_id: string | null;
}

export type LoadBusinessResult =
  | { kind: "ok"; business: BusinessInfo }
  | { kind: "empty" }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

export type SaveBusinessResult =
  | { kind: "ok"; id: string }
  | { kind: "no-config" }
  | { kind: "error"; message: string };

/** UI field ↔ businesses.column — the app field names never change. */
function rowToBusiness(row: BusinessRow): BusinessInfo {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    whatsapp: row.whatsapp ?? "",
    currency: row.currency ?? "USD",
    logoUrl: row.logo_url ?? "",
    discountsEnabled: row.discounts_enabled ?? true,
    websiteUrl: row.website_url ?? "",
  };
}

async function getSignedInUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await getSupabaseClient().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the signed-in user's business. RLS guarantees only rows owned by
 * this user are visible, so no "oldest row" guesswork remains.
 */
export async function loadBusiness(): Promise<LoadBusinessResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const userId = await getSignedInUserId();
    if (!userId) return { kind: "empty" }; // not signed in: nothing to load

    const client = getSupabaseClient();

    // Dev/test compatibility: adopt the single legacy (pre-auth) business
    // before the first read, so its owner finds their data instead of an
    // empty setup form. No-op once ownership is set; never duplicates.
    const { data: claimedId } = await client.rpc("claim_legacy_business");
    if (claimedId) {
      const { data: claimed, error: claimedError } = await client
        .from("businesses")
        .select("*")
        .eq("id", claimedId as string)
        .maybeSingle();
      if (claimedError) return { kind: "error", message: claimedError.message };
      if (claimed) return { kind: "ok", business: rowToBusiness(claimed as BusinessRow) };
    }

    const { data, error } = await client
      .from("businesses")
      .select("*")
      .limit(1);

    if (error) return { kind: "error", message: error.message };

    const row = (data ?? [])[0];
    if (!row) return { kind: "empty" };
    return { kind: "ok", business: rowToBusiness(row as BusinessRow) };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}

/**
 * Save = update the user's business if one exists, else create it with
 * owner_user_id = the authenticated user's id (never null).
 */
export async function saveBusiness(
  business: BusinessInfo,
): Promise<SaveBusinessResult> {
  if (!isSupabaseConfigured) return { kind: "no-config" };
  try {
    const client = getSupabaseClient();

    const { data, error: selectError } = await client
      .from("businesses")
      .select("id")
      .limit(1);
    if (selectError) return { kind: "error", message: selectError.message };

    const existingId = (data ?? [])[0]?.id as string | undefined;

    const payload = {
      name: business.name,
      email: business.email || null,
      phone: business.phone || null,
      whatsapp: business.whatsapp || null,
      address: business.address || null,
      currency: business.currency,
      logo_url: business.logoUrl || null,
      discounts_enabled: business.discountsEnabled,
      website_url: business.websiteUrl || null,
    };

    if (existingId) {
      // RLS scopes the UPDATE to the owner's own row.
      const { error } = await client
        .from("businesses")
        .update(payload)
        .eq("id", existingId);
      if (error) return { kind: "error", message: error.message };
      return { kind: "ok", id: existingId };
    }

    const userId = await getSignedInUserId();
    if (!userId) {
      return { kind: "error", message: "You need to be logged in to set up your business." };
    }

    // New business: ownership is stamped from the session — never null,
    // never taken from localStorage.
    const { data: inserted, error } = await client
      .from("businesses")
      .insert({ ...payload, owner_user_id: userId })
      .select("id")
      .single();
    if (error) return { kind: "error", message: error.message };
    return { kind: "ok", id: (inserted as { id: string }).id };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unknown database error.",
    };
  }
}
