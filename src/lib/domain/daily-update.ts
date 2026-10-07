"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useEmployeeTransactions } from "../employee-transactions";
import type { CompletedSale } from "../employee-sales";
import { useProducts } from "../products-store";
import { useStockMovements, type StockMovement } from "./stock-movements";
import { useAttendance } from "./attendance";
import { useFollowUps } from "./follow-ups";
import {
  buildEndOfDayReport,
  isSameLocalDay,
} from "./end-of-day-report";
import { useTodayKpis } from "./owner-overview";
import { useAttentionItems } from "../attention";
import { activeNotifications, raiseNotification } from "./notifications";
import { formatMoneyWhole } from "../currency-symbol";
import { getBusinessInfo } from "../business-store";
import {
  productBrand,
  productCategory,
} from "../product-meta";
import { stockStatus } from "./stock-state";
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
  /** Yesterday's sales value (for the compact ₦2.45M-style summary). */
  yesterdaySales: number;
  /** Yesterday's outstanding (sales value − received). */
  yesterdayOutstanding: number;
  /** Staff with activity yesterday/today (Workplace Attendance). */
  staffScheduled: number;
  /** Open (unresolved) orders — transactions with a balance. */
  pendingOrders: number;
  /** Open customer follow-ups (due + overdue). */
  pendingFollowUps: number;
  /** Grouped stock overview (spec §11) — business-type aware, capped. */
  stockGroups: StockGroup[];
  /** Low-stock / out-of-stock counts for the exceptions line. */
  lowCount: number;
  outCount: number;
}

/**
 * One grouped stock line (spec §11): electronics groups Brand → Variant,
 * other businesses group by category → item. Derived from the SAME product
 * metadata the whole app uses — no electronics hard-coding: whatever brand
 * /variant data exists is used; anything without falls into a clean
 * category → product list. Groups are capped so the notification stays a
 * concise overview, never an inventory dump.
 */
export interface StockGroup {
  /** Group heading, e.g. "Hisense" or "Air Conditioners". */
  label: string;
  /** Sub-lines, e.g. "1.5HP Inverter AC — 7" or "Hisense 1HP AC — 10". */
  items: { label: string; qty: number }[];
  /** Total units in this group. */
  totalUnits: number;
}

/** "Saturday, September 26" (no year — the update is always about now). */
function shortDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* ---------------- Stock grouping (spec §11) ---------------- */

/** Maximum groups + items per group rendered in the notification. */
const MAX_GROUPS = 4;
const MAX_ITEMS_PER_GROUP = 4;

/**
 * Extract a variant/capacity fragment from a product name by stripping the
 * brand and the generic category words — "Hisense 1.5HP Inverter AC" with
 * brand "Hisense" → "1.5HP Inverter AC". Business-type agnostic: the
 * leftover words ARE the variant (size, colour, capacity, model…).
 */
function variantOf(name: string, brand: string): string {
  let rest = name;
  if (brand && rest.toLowerCase().startsWith(brand.toLowerCase())) {
    rest = rest.slice(brand.length).trim();
  }
  return rest || name;
}

/**
 * Group the catalog the way the owner thinks about stock (spec §11).
 * When brands exist (electronics, fashion): Brand → Variant → Qty.
 * When they don't (restaurant, salon): Category → Item → Qty.
 * Capped to keep the morning update concise.
 */
export function groupStockForUpdate(products: Product[]): StockGroup[] {
  const brandless = products.every((p) => !productBrand(p.name));
  const groups = new Map<string, Map<string, number>>();

  for (const p of products) {
    const brand = productBrand(p.name);
    const category = productCategory(p.name);
    const groupLabel = brandless ? category || "Other" : brand || category || "Other";
    const itemLabel = brandless
      ? p.name
      : variantOf(p.name, brand || "");
    const inner = groups.get(groupLabel) ?? new Map<string, number>();
    inner.set(itemLabel, (inner.get(itemLabel) ?? 0) + p.stock);
    groups.set(groupLabel, inner);
  }

  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      items: [...items.entries()]
        .slice(0, MAX_ITEMS_PER_GROUP)
        .map(([itemLabel, qty]) => ({ label: itemLabel, qty })),
      totalUnits: [...items.values()].reduce((s, q) => s + q, 0),
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, MAX_GROUPS);
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
  attendanceToday?: { employeeName: string; status: string }[];
  followUps?: { dueAt: string; completedAt: string | null }[];
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

  // Stock exceptions from the ONE shared stock-state source.
  let lowCount = 0;
  let outCount = 0;
  for (const p of products) {
    const status = stockStatus(p);
    if (status === "low") lowCount += 1;
    else if (status === "out") outCount += 1;
  }

  // Pending: open orders (balance > 0) + open follow-ups.
  const pendingOrders = transactions.filter((s) => s.balance > 0).length;
  const followUps = input.followUps ?? [];
  const pendingFollowUps = followUps.filter((f) => !f.completedAt).length;

  // Staff seen in attendance records today (spec §11 "Staff scheduled").
  const staffNames = new Set((input.attendanceToday ?? []).map((a) => a.employeeName));

  return {
    dateLabel: shortDayLabel(today),
    attentionCount: attention.length,
    attention: lines,
    outstandingToday,
    hasYesterday: yReport.summary.hasSales,
    yesterdayReceived: yReport.summary.moneyReceived,
    yesterdayTransactions: yReport.summary.transactionCount,
    yesterdaySales: yReport.summary.salesValue,
    yesterdayOutstanding: Math.max(
      0,
      yReport.summary.salesValue - yReport.summary.moneyReceived,
    ),
    staffScheduled: staffNames.size,
    pendingOrders,
    pendingFollowUps,
    stockGroups: groupStockForUpdate(products),
    lowCount,
    outCount,
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
  const attendance = useAttendance();
  const followUps = useFollowUps();

  return useMemo(() => {
    if (!today) return null;
    const info = getBusinessInfo();
    // Today's attendance attempts, summarized (spec §11 "Staff").
    const attendanceToday = attendance
      .filter((r) => isSameLocalDay(r.at, today))
      .map((r) => ({ employeeName: r.employeeName, status: r.status }));
    return buildDailyUpdate({
      today,
      businessName: info.name || "Your business",
      currency: info.currency || "NGN",
      transactions,
      products,
      movements,
      attention,
      attendanceToday,
      followUps: followUps.map((f) => ({ dueAt: f.dueAt, completedAt: f.completedAt })),
    });
  }, [today, transactions, products, movements, attention, attendance, followUps]);
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
