"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { useBusiness } from "@/lib/business-store";
import { formatDate, getCustomerName, cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";
import { effectiveStatus, invoiceAmount, formatDueIn } from "@/lib/invoice-utils";

type StatusFilter = "all" | "unpaid" | "paid";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const { invoices, status, error, reload, clearError } = useInvoices();
  const { customers } = useCustomers();
  const { business } = useBusiness();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const customerNames = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .map((inv) => ({ inv, status: effectiveStatus(inv) }))
      .filter(({ inv, status }) => {
        if (filter === "unpaid" && status === "paid") return false;
        if (filter === "paid" && status !== "paid") return false;
        if (!q) return true;
        const customerName = customerNames.get(inv.customerId) ?? "";
        return (
          inv.number.toLowerCase().includes(q) ||
          customerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate));
  }, [invoices, customerNames, query, filter]);

  const unpaidCount = filtered.filter((f) => f.status !== "paid").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {filtered.length} invoice{filtered.length === 1 ? "" : "s"}
            {unpaidCount > 0
              ? ` · ${unpaidCount} unpaid`
              : ""}
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/invoices/new")} size="md">
          <Plus aria-hidden className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* Database status — same alert styles used elsewhere in the app */}
      {status === "error" && error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Could not load your invoices: {error}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}
      {status === "ready" && error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Something did not save: {error}</span>
          <button
            type="button"
            onClick={clearError}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Card>
        {/* Search + status filter */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by number or customer…"
              aria-label="Search invoices"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-canvas pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1" role="group" aria-label="Filter invoices by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value
                    ? "bg-surface text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2.5 font-medium">Invoice</th>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Due date</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(({ inv, status }) => (
                <tr key={inv.id} className="group transition-colors hover:bg-zinc-50/60">
                  <td className="px-5 py-3.5 font-medium text-zinc-900">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="hover:text-brand-700">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">
                    {getCustomerName(customerNames, inv.customerId)}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">
                    {formatDate(inv.dueDate)}
                    {status !== "paid" ? (
                      <span className={cn("block text-xs", status === "overdue" ? "text-red-600" : "text-zinc-400")}>
                        {formatDueIn(inv.dueDate)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900">
                    {formatMoney(invoiceAmount(inv), business.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {filtered.map(({ inv, status }) => (
            <li key={inv.id}>
              <Link
                href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {getCustomerName(customerNames, inv.customerId)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {inv.number} · due {formatDate(inv.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">
                    {formatMoney(invoiceAmount(inv), business.currency)}
                  </p>
                  <div className="mt-1 flex justify-end">
                    <StatusBadge status={status} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText aria-hidden className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-900">
              {query || filter !== "all" ? "No invoices match your filters" : "No invoices yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {query || filter !== "all"
                ? "Try a different search or status filter."
                : "Create your first invoice to start getting paid."}
            </p>
            {!(query || filter !== "all") ? (
              <Button className="mt-4" onClick={() => router.push("/dashboard/invoices/new")}>
                <Plus aria-hidden className="h-4 w-4" />
                Create Invoice
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
