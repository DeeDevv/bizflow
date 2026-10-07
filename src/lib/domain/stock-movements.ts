"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Stock movement ledger (Phase 5).
 *
 * Every inventory change — sale deduction, receiving, adjustment — is
 * recorded here BY THE AUTOMATION ENGINE (never by UI), so the product
 * detail and history views can answer "what happened to this stock, who
 * did it, when, and why" (spec §10, §25).
 *
 * Local/mock persistence now; becomes a query over the movements table
 * when the new Supabase project lands. The shape mirrors that query.
 */

export type MovementKind = "sale" | "receive" | "adjust";

export interface StockMovement {
  id: string;
  kind: MovementKind;
  productId: string;
  productName: string;
  /** Signed quantity: negative = out, positive = in. */
  quantity: number;
  /** Stock before and after — the human-readable trail. */
  stockBefore: number;
  stockAfter: number;
  /** Who performed the action. */
  actor: string;
  /** Adjustment reason (damaged/missing/…) — undefined for sales/receiving. */
  reason?: string;
  /** Free note where applicable. */
  note?: string;
  /** Linking reference: sale ref (BM-…), receiving ref, adjustment ref. */
  reference?: string;
  /** ISO timestamp. */
  at: string;
  /**
   * COST BASIS (Phase 8.6, spec §6): the per-unit cost of this batch for
   * "receive" movements. Each receipt remembers its own cost — January's
   * ₦320,000 stock never silently becomes March's ₦350,000 (spec §6).
   * Sales consume from the oldest batches first; the finance module
   * converts sale batches into COGS from this ledger. null = no cost was
   * entered (legacy rows / $0 items); treated as zero cost, not hidden.
   */
  unitCost?: number | null;
  /**
   * For "sale" movements: the actual selling price charged per unit in the
   * linked transaction (spec §5's actual-sale calculations read revenue
   * from here rather than re-deriving it from the transaction store).
   */
  unitPrice?: number | null;
}

const store = createPersistentStore<StockMovement[]>("bizmate.stock-movements.v1", []);

const EMPTY: StockMovement[] = [];

function getSnapshot(): StockMovement[] {
  return store.get();
}

function getServerSnapshot(): StockMovement[] {
  return EMPTY;
}

/** Record one movement. Called only by the automation engine. */
export function recordStockMovement(input: Omit<StockMovement, "id" | "at">): StockMovement {
  const full: StockMovement = {
    id: `mov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...input,
  };
  store.set([full, ...store.get()]);
  return full;
}

/** Movements for one product, newest first. */
export function movementsForProduct(productId: string): StockMovement[] {
  return store.get().filter((m) => m.productId === productId);
}

/** All movements, newest first (inventory history view). */
export function useStockMovements(): StockMovement[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** Human label for a movement, e.g. "Sale BM-1024" / "Damaged units". */
export function movementLabel(m: StockMovement): string {
  switch (m.kind) {
    case "sale":
      return `Sale${m.reference ? ` ${m.reference}` : ""}`;
    case "receive":
      return `Stock received${m.reference ? ` ${m.reference}` : ""}`;
    case "adjust":
      return `Adjustment — ${m.reason ?? "Correction"}${m.reference ? ` ${m.reference}` : ""}`;
  }
}
