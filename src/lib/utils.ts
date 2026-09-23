/**
 * Display helpers shared across the app.
 * Kept dependency-free so they run on server and client components alike.
 */

import type { InvoiceStatus } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("en-US");

/** "$128,430" — for large money amounts (cards, charts) */
export function formatCurrency(value: number): string {
  return usd.format(value);
}

/** "$1,284.50" — for invoice line amounts */
export function formatCurrencyPrecise(value: number): string {
  return usdPrecise.format(value);
}

/** "1,284" */
export function formatNumber(value: number): string {
  return number.format(value);
}

/** Compact axis label: 120000 -> "$120k" */
export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

/** "+12.4%" — sign included */
export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return fullDate.format(new Date(iso));
}

export function formatDayMonth(iso: string): string {
  return dayMonth.format(new Date(iso));
}

export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(iso));
}

/** Tiny class combiner (avoids adding clsx for now) */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Look up a customer's display name; falls back gracefully if removed. */
export function getCustomerName(
  customerMap: Map<string, string>,
  customerId: string,
): string {
  return customerMap.get(customerId) ?? "Unknown customer";
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  draft: "Draft",
};
