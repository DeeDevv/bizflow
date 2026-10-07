"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag, CircleDollarSign } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatCurrencyPrecise,
  formatDate,
  getCustomerName,
  cn,
} from "@/lib/utils";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { useBusiness } from "@/lib/business-store";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { toSales, salesTotal } from "@/lib/sales";

type DateFilter = "all" | "30d" | "90d" | "year";

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

export default function SalesPage() {
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { business } = useBusiness();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const customerNames = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  const allSales = useMemo(() => toSales(invoices, customerNames), [invoices, customerNames]);

  const cutoff = useMemo(() => {
    const d = new Date();
    if (dateFilter === "30d") d.setDate(d.getDate() - 30);
    else if (dateFilter === "90d") d.setDate(d.getDate() - 90);
    else if (dateFilter === "year") d.setMonth(0, 1);
    return dateFilter === "all" ? null : d.toISOString().slice(0, 10);
  }, [dateFilter]);

  const filtered = useMemo(
    () =>
      allSales
        .filter((s) => (cutoff ? s.date >= cutoff : true))
        .filter((s) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            s.number.toLowerCase().includes(q) ||
            s.customerName.toLowerCase().includes(q)
          );
        }),
    [allSales, cutoff, query],
  );

  const total = salesTotal(filtered);
  const count = filtered.length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sales</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Money you have received. A sale is created when an invoice is paid.
        </p>
      </div>

      <Card>
        {/* Stats + search + date filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
              <CircleDollarSign aria-hidden className="h-4 w-4 text-brand-600" />
              Total received:{" "}
              <span className="font-semibold text-zinc-900">
                {formatMoneyWhole(total, business.currency || "NGN")}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
              <ShoppingBag aria-hidden className="h-4 w-4 text-brand-600" />
              <span className="font-semibold text-zinc-900">
                {count}
              </span>{" "}
              completed sale{count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1 sm:max-w-xs">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by customer or invoice…"
                aria-label="Search sales"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-canvas pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1" role="group" aria-label="Filter sales by date">
              {DATE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setDateFilter(f.value)}
                  aria-pressed={dateFilter === f.value}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    dateFilter === f.value
                      ? "bg-surface text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Invoice</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-right font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((sale) => (
                <tr key={sale.id} className="group transition-colors hover:bg-zinc-50/60">
                  <td className="px-5 py-3.5 text-zinc-500">{formatDate(sale.date)}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900">
                    <Link href={`/dashboard/sales/${sale.id}`} className="hover:text-brand-700">
                      {getCustomerName(customerNames, sale.invoice.customerId)}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">{sale.number}</td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900">
                    {formatCurrencyPrecise(sale.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status="paid" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {filtered.map((sale) => (
            <li key={sale.id}>
              <Link
                href={`/dashboard/sales/${sale.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {getCustomerName(customerNames, sale.invoice.customerId)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {formatDate(sale.date)} · {sale.number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">
                    {formatCurrencyPrecise(sale.amount)}
                  </p>
                  <div className="mt-1 flex justify-end">
                    <StatusBadge status="paid" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ShoppingBag aria-hidden className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-900">
              {query || cutoff ? "No sales match your filters" : "No sales yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {query || cutoff
                ? "Try a different search or date range."
                : "When an invoice is paid, the sale appears here."}
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
