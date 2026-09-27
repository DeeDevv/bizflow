"use client";

import { lowStockThreshold, stockStatus } from "./stock-state";
import type { Product } from "../types";

/**
 * Automation rules (Phase 8) — the STRUCTURE of what BizMate watches and
 * does, written the way the owner thinks about it:
 *
 *   WHEN  something happens in the business
 *   CHECK the owner's own setup (thresholds they chose)
 *   DO    what BizMate should do about it
 *
 * The two live rules describe what the automation engine (Phase 4) already
 * does on every sale, receipt, and adjustment — no second engine runs here.
 * The rest are part of BizMate's design, shown as "coming later" so the
 * owner can see where the product is going without anything pretending to
 * be active. When a future phase ships rule execution, these definitions
 * become its configuration — nothing here is throwaway.
 */

/** What BizMate does about a rule. */
export interface AutomationRule {
  id: string;
  /** Owner-facing name — plain words, not an event name. */
  name: string;
  /** The WHEN: what happens in the business. */
  trigger: string;
  /** The CHECK: what BizMate compares against the owner's own setup. */
  check: string;
  /** The DO: what BizMate does about it. */
  action: string;
  /** Live today (the engine already runs it) vs designed, not yet active. */
  status: "active" | "coming_later";
}

/**
 * The rule registry. The ACTIVE entries are documentation of real behavior —
 * they mirror exactly what processSaleCompleted / processStockReceived /
 * processStockAdjusted already do (see automation.ts). Kept in one place so
 * a future engine phase can enforce "every automated behavior is listed
 * here, in owner words".
 */
export const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "low-stock",
    name: "Low stock warning",
    trigger: "A sale brings a product to its low-stock level",
    check: "the low-stock level you set for that product",
    action: "Tell you once, and keep one live reminder until stock arrives",
    status: "active",
  },
  {
    id: "out-of-stock",
    name: "Out-of-stock alert",
    trigger: "A sale takes a product to zero",
    check: "stock reaching zero",
    action: "Alert you straight away so you can restock before more orders",
    status: "active",
  },
  {
    id: "outstanding-balance",
    name: "Outstanding balance notice",
    trigger: "A customer leaves part of what they owe unpaid",
    check: "any sale with a remaining balance",
    action: "Record it on your attention list until the balance is settled",
    status: "active",
  },
  {
    id: "daily-report",
    name: "Daily report ready",
    trigger: "Your day's first transaction is recorded",
    check: "one notice per day",
    action: "Mark today's report as ready so you never forget to look",
    status: "active",
  },
  {
    id: "restock-suggestion",
    name: "Restock suggestion",
    trigger: "Stock is running low",
    check: "how quickly each product sells",
    action: "Suggest how much to receive before you run out",
    status: "coming_later",
  },
  {
    id: "day-end-reminders",
    name: "Day-end reminders",
    trigger: "The working day ends",
    check: "sales, payments, and stock for the day",
    action: "Nudge you with anything left undone before you close",
    status: "coming_later",
  },
  {
    id: "invoice-reminders",
    name: "Invoice reminders",
    trigger: "An invoice passes its due date",
    check: "invoices still unpaid after the due date you set",
    action: "Remind you to follow up with the customer",
    status: "coming_later",
  },
] as const;

/** Rules the engine actually runs today — for badges on the settings view. */
export function activeRules(): AutomationRule[] {
  return AUTOMATION_RULES.filter((r) => r.status === "active");
}

/**
 * What BizMate is watching RIGHT NOW for one product, in owner words.
 * Used by the rules view to show the structure is real: the same
 * stock-state source the engine and every view use — no second algorithm.
 */
export function describeProductWatch(product: Product): string {
  const status = stockStatus(product);
  const threshold = lowStockThreshold(product);
  if (status === "out") {
    return `${product.name}: out of stock — BizMate is alerting you to restock.`;
  }
  if (status === "low") {
    return `${product.name}: ${product.stock} left — at or below your low-stock level of ${threshold}.`;
  }
  return `${product.name}: ${product.stock} in stock — watching for your low-stock level of ${threshold}.`;
}
