"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  BanknoteArrowUp,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatNumber, formatPercent, cn } from "@/lib/utils";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { useBusiness } from "@/lib/business-store";
import { effectiveStatus, invoiceAmount } from "@/lib/invoice-utils";
import { receivedFor } from "@/lib/sales";

/** Plain-language KPI cards — every number is computed from the live stores. */
export function KpiCards() {
  const { invoices, payments, status, error, reload } = useInvoices();
  const { customers } = useCustomers();
  const { business } = useBusiness();

  if (status === "loading") {
    return <KpiSkeleton />;
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        <span>Could not load your numbers: {error}</span>
        <button
          type="button"
          onClick={reload}
          className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }

  // Money actually received (revenue): real payment records for open
  // invoices plus the full amount of invoices finalized as paid —
  // "Mark as Paid" asserts the money arrived even without a payment row.
  // Drafts count nothing.
  const paidSoFar = new Map<string, number>();
  for (const payment of payments) {
    paidSoFar.set(
      payment.invoiceId,
      (paidSoFar.get(payment.invoiceId) ?? 0) + payment.amount,
    );
  }
  const received = invoices.reduce(
    (sum, inv) => sum + receivedFor(inv, paidSoFar.get(inv.id) ?? 0),
    0,
  );

  // Outstanding = what customers still owe: invoice amount minus real
  // payments received, for every non-paid invoice (paid ⇒ fully covered).
  const unpaid = invoices.filter((inv) => {
    const s = effectiveStatus(inv);
    return s === "pending" || s === "overdue";
  });
  const outstanding = unpaid.reduce(
    (sum, inv) =>
      sum + Math.max(0, invoiceAmount(inv) - (paidSoFar.get(inv.id) ?? 0)),
    0,
  );

  // This month (so far) vs last calendar month, bucketed by payment date.
  const byMonth = new Map<string, number>();
  for (const inv of invoices) {
    const rec = receivedFor(inv, paidSoFar.get(inv.id) ?? 0);
    if (rec <= 0) continue;
    const month = `${(inv.paidAt ?? inv.issueDate).slice(0, 7)}-01`;
    byMonth.set(month, (byMonth.get(month) ?? 0) + rec);
  }
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const current = byMonth.get(monthKey(now)) ?? 0;
  const previous = byMonth.get(monthKey(prevMonthDate)) ?? 0;
  // No comparison shown when last month had no sales — a percentage against
  // zero would be meaningless.
  const salesChange = previous > 0 ? (current - previous) / previous : null;

  const kpis: {
    label: string;
    value: string;
    change: number | null;
    changeLabel: string;
    href: string;
    icon: LucideIcon;
    iconClass: string;
  }[] = [
    {
      label: "Total Sales",
      value: formatMoneyWhole(received, business.currency),
      change: salesChange,
      changeLabel: "vs last month · money received",
      href: "/dashboard/sales",
      icon: BanknoteArrowUp,
      iconClass: "bg-brand-50 text-brand-600",
    },
    {
      label: "Outstanding Invoices",
      value: formatMoneyWhole(outstanding, business.currency),
      change: null,
      changeLabel: `${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`,
      href: "/dashboard/invoices",
      icon: ReceiptText,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      label: "Total Customers",
      value: formatNumber(customers.length),
      change: null,
      changeLabel: "people you do business with",
      href: "/dashboard/customers",
      icon: Users,
      iconClass: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpis.map((kpi) => {
        const good = (kpi.change ?? 0) >= 0;
        const TrendIcon = good ? ArrowUpRight : ArrowDownRight;
        return (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    kpi.iconClass,
                  )}
                >
                  <kpi.icon className="h-5 w-5" />
                </span>
                <p className="text-sm text-zinc-500">{kpi.label}</p>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
                {kpi.value}
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-400">
                {kpi.change != null ? (
                  <>
                    <TrendIcon
                      aria-hidden
                      className={cn("h-3.5 w-3.5", good ? "text-emerald-500" : "text-red-500")}
                    />
                    <span className={cn("font-medium", good ? "text-emerald-600" : "text-red-600")}>
                      {formatPercent(kpi.change)}
                    </span>
                    <span>{kpi.changeLabel}</span>
                  </>
                ) : (
                  <span>{kpi.changeLabel}</span>
                )}
              </p>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/** Same three-card grid shape, rendered while the database loads. */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-full p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100" />
            <span aria-hidden className="h-3.5 w-24 rounded bg-zinc-100" />
          </div>
          <span aria-hidden className="mt-4 block h-7 w-32 rounded bg-zinc-100" />
          <span aria-hidden className="mt-1.5 block h-3 w-40 rounded bg-zinc-100" />
        </Card>
      ))}
    </div>
  );
}
