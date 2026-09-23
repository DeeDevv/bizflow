"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useCustomers } from "@/lib/customers-store";
import { useInvoices } from "@/lib/invoices-store";
import {
  formatCurrencyPrecise,
} from "@/lib/utils";
import {
  getCustomerOutstanding,
  getCustomerTotalPurchases,
} from "@/lib/customer-metrics";

export default function CustomersPage() {
  const { customers, status, error, reload, clearError } = useCustomers();
  const { invoices } = useInvoices();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="md">
          <Plus aria-hidden className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Database status — same alert styles used elsewhere in the app */}
      {status === "error" && error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Could not load your customers: {error}</span>
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
        {/* Search */}
        <div className="border-b border-zinc-100 p-4">
          <div className="relative max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers…"
              aria-label="Search customers"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-canvas pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Phone</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 text-right font-medium">Total Purchases</th>
                <th className="px-5 py-2.5 text-right font-medium">Outstanding</th>
                <th className="px-5 py-2.5" aria-label="Open" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((customer) => {
                const outstanding = getCustomerOutstanding(customer.id, invoices);
                return (
                  <tr key={customer.id} className="group transition-colors hover:bg-zinc-50/60">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar name={customer.name} />
                        <span className="font-medium text-zinc-900 group-hover:text-brand-700">
                          {customer.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-zinc-600">{customer.phone}</td>
                    <td className="px-5 py-3.5 text-zinc-600">{customer.email}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatCurrencyPrecise(getCustomerTotalPurchases(customer.id, invoices))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {outstanding > 0 ? (
                        <span className="font-medium tabular-nums text-amber-700">
                          {formatCurrencyPrecise(outstanding)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">All paid</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ChevronRight
                        aria-hidden
                        className="ml-auto h-4 w-4 text-zinc-300 group-hover:text-zinc-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {filtered.map((customer) => {
            const outstanding = getCustomerOutstanding(customer.id, invoices);
            return (
              <li key={customer.id}>
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50/60"
                >
                  <Avatar name={customer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{customer.name}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{customer.phone}</p>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      Purchases{" "}
                      <span className="font-medium text-zinc-900">
                        {formatCurrencyPrecise(
                          getCustomerTotalPurchases(customer.id, invoices),
                        )}
                      </span>
                      {outstanding > 0 ? (
                        <>
                          {" · "}Owes{" "}
                          <span className="font-medium text-amber-700">
                            {formatCurrencyPrecise(outstanding)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-300" />
                </Link>
              </li>
            );
          })}
        </ul>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <UserRound aria-hidden className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-900">
              {query ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {query
                ? "Try a different name, email, or phone number."
                : "Add your first customer to start tracking sales."}
            </p>
            {!query ? (
              <Button onClick={() => setFormOpen(true)} className="mt-4">
                <Plus aria-hidden className="h-4 w-4" />
                Add Customer
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {formOpen ? <CustomerFormModal onClose={() => setFormOpen(false)} /> : null}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600"
    >
      {initials}
    </span>
  );
}
