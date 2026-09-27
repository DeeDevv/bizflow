"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useEmployeeTransactions } from "../employee-transactions";
import type { CompletedSale } from "../employee-sales";
import { useProducts } from "../products-store";
import { useStockMovements, type StockMovement } from "./stock-movements";
import {
  buildEndOfDayReport,
  isSameLocalDay,
} from "./end-of-day-report";
import { useTodayKpis } from "./owner-overview";
import { useAttentionItems } from "../attention";
import { activeNotifications, raiseNotification } from "./notifications";
import { formatMoneyWhole } from "../currency-symbol";
import { getBusinessInfo } from "../business-store";
import type { Product } from "../types";

/**
 * Daily Business Update (Phase 8) — the owner's short morning summary.
 *
 * A DERIVED VIEW, exactly like the End-of-Day Report: it reuses the ONE
 * shared calculations instead of re-deriving anything.
 *
 *   Attention   → useAttentionItems() (the same source the bell shows)
 *   Outstanding → today's transactions (same definition as Phase 4/6/7)
 *   Yesterday   → buildEndOfDayReport() for yesterday's LOCAL calendar day
 *                 (the Phase 7 deterministic generator, different date)
 *
 * No new persistence, no new calculations — no competing source of truth.
 * Every line has an empty state: a quiet morning is shown as quiet, never
 * padded with fake figures.
 */

export interface DailyUpdateLine {
  id: string;
  text: string;
  /** Severity styling for the leading dot — clear labels, never scores. */
  severity: "info" | "warning" | "critical";
  href: string;
}

export interface DailyUpdate {
  /** "Saturday, September 26" for the card heading. */
  dateLabel: string;
  /** Total unresolved business conditions the owner should look at. */
  attentionCount: number;
  attention: DailyUpdateLine[];
  /** Outstanding money on TODAY's transactions (not yesterday's). */
  outstandingToday: number;
  /** True when yesterday has at least one transaction. */
  hasYesterday: boolean;
  /** Money actually received yesterday. */
  yesterdayReceived: number;
  /** Completed transactions yesterday. */
  yesterdayTransactions: number;
}

/** "Saturday, September 26" (no year — the update is always about now). */
function shortDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build the update from raw inputs. Pure and deterministic — the same
 * business data always produces the same summary. Exported for reuse;
 * the hook below is the thin React adapter.
 */
export function buildDailyUpdate(input: {
  today: Date;
  businessName: string;
  currency: string;
  transactions: CompletedSale[];
  products: Product[];
  movements: StockMovement[];
  attention: { severity?: "critical" | "important"; title: string; href: string }[];
}): DailyUpdate {
  const { today, businessName, currency, transactions, products, movements, attention } =
    input;
  const money = (v: number) => formatMoneyWhole(v, currency);

  // Attention lines reuse the shared severity mapping — out of stock reads
  // as critical, everything else as needing a look. Most urgent first.
  const lines: DailyUpdateLine[] = attention
    .slice(0, 4)
    .map((a) => ({
      id: `upd-${a.title}`,
      text: a.title,
      severity: a.severity === "critical" ? "critical" : "warning",
      href: a.href,
    }));

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yReport = buildEndOfDayReport({
    businessName,
    date: yesterday,
    transactions,
    products,
    movements,
  });

  // Today's outstanding — the same definition as the KPI grid and the
  // report (sales value minus what was actually received).
  const todays = transactions.filter((s) => isSameLocalDay(s.completedAt, today));
  const saleValue = todays.reduce((sum, s) => sum + s.total, 0);
  const receivedToday = todays.reduce((sum, s) => sum + s.amountPaid, 0);
  const outstandingToday = Math.max(0, saleValue - receivedToday);
  if (outstandingToday > 0) {
    lines.push({
      id: "upd-outstanding-today",
      text: `${money(outstandingToday)} is still outstanding from today's sales.`,
      severity: "warning",
      href: "/dashboard/employee/transactions",
    });
  }

  return {
    dateLabel: shortDayLabel(today),
    attentionCount: attention.length,
    attention: lines,
    outstandingToday,
    hasYesterday: yReport.summary.hasSales,
    yesterdayReceived: yReport.summary.moneyReceived,
    yesterdayTransactions: yReport.summary.transactionCount,
  };
}

/* ---------------- Local-day clock (hydration-safe) ---------------- */

/**
 * The local calendar day as an external store. getSnapshot returns a CACHED
 * Date (stable reference within a day) — a fresh `new Date()` here would
 * re-render forever. Like the Command Center greeting, the server snapshot
 * is null so nothing clock-dependent renders during SSR/hydration.
 */
let cachedDay: Date | null = null;
let cachedDayKey = "";
const clockSubscribe = (): (() => void) => () => {};
function useLocalDay(): Date | null {
  return useSyncExternalStore(
    clockSubscribe,
    () => {
      const now = new Date();
      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (cachedDayKey !== key) {
        cachedDayKey = key;
        cachedDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      return cachedDay;
    },
    () => null,
  );
}

/** The live update, or null before hydration (nothing clock-based on SSR). */
export function useDailyBusinessUpdate(): DailyUpdate | null {
  const today = useLocalDay();
  const transactions = useEmployeeTransactions();
  const { products } = useProducts();
  const movements = useStockMovements();
  const attention = useAttentionItems();

  return useMemo(() => {
    if (!today) return null;
    const info = getBusinessInfo();
    return buildDailyUpdate({
      today,
      businessName: info.name || "Your business",
      currency: info.currency || "NGN",
      transactions,
      products,
      movements,
      attention,
    });
  }, [today, transactions, products, movements, attention]);
}

/**
 * Report-ready notice effect. Call from ONE mounted owner surface (the
 * Command Center — the owner's home). Idempotent per day by the store's
 * own (kind, subjectId) rule: subjectId = the report's LOCAL day, so the
 * notice appears once per day and simply re-links if revisited.
 * Only raised once the business has at least one transaction — an empty
 * business gets no report notice.
 */
export function useReportReadyNotification(): void {
  const today = useLocalDay();
  const kpis = useTodayKpis();

  useEffect(() => {
    if (!today || !kpis.hasData) return;
    const subjectId = `eod-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    // Store dedupe would keep one record, but skip the re-raise entirely so
    // revisiting the dashboard never bumps the notice's timestamp.
    if (
      activeNotifications().some(
        (n) => n.kind === "report_ready" && n.subjectId === subjectId,
      )
    )
      return;
    raiseNotification({
      kind: "report_ready",
      title: "Today's business report is ready",
      detail:
        "Sales, payments, outstanding balances, and current stock for today — in one report.",
      href: "/dashboard/report",
      subjectId,
    });
  }, [today, kpis.hasData]);
}
