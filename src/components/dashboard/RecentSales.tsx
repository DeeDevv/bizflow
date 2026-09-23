"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { useBusiness } from "@/lib/business-store";
import { toReceivedEvents } from "@/lib/sales";

/** Recent sales — the latest payments received. Table on desktop, rows on mobile. */
export function RecentSales() {
  const { invoices, payments, status, error, reload } = useInvoices();
  const { customers } = useCustomers();
  const { business } = useBusiness();
  const customerNames = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  // Real payment records — every row is money that actually arrived.
  const recent = useMemo(
    () => toReceivedEvents(payments, invoices, customerNames).slice(0, 5),
    [payments, invoices, customerNames],
  );

  if (status === "loading") {
    return (
      <Card>
        <CardHeader title="Recent Sales" subtitle="The latest payments you've received" />
        <div className="space-y-3 px-5 py-6">
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden className="block h-5 w-full rounded bg-zinc-100" />
          ))}
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <CardHeader title="Recent Sales" subtitle="The latest payments you've received" />
        <div
          role="alert"
          className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Could not load your sales: {error}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recent Sales"
        subtitle="The latest payments you've received"
        action={
          <Link
            href="/dashboard/sales"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            View all
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {recent.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-900">No sales yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            When you record a payment, the sale shows up here.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recent.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-zinc-50/60">
                    <td className="px-5 py-3.5 text-zinc-500">{formatDate(sale.date)}</td>
                    <td className="px-5 py-3.5 font-medium text-zinc-900">
                      <Link
                        href={`/dashboard/sales/${sale.invoiceId}`}
                        className="hover:text-brand-700"
                      >
                        {sale.customerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">{sale.invoiceNumber}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatMoney(sale.amount, business.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile rows */}
          <ul className="divide-y divide-zinc-100 md:hidden">
            {recent.map((sale) => (
              <li key={sale.id} className="px-5 py-3.5">
                <Link
                  href={`/dashboard/sales/${sale.invoiceId}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {sale.customerName}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {formatDate(sale.date)} · {sale.invoiceNumber}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                    {formatMoney(sale.amount, business.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
