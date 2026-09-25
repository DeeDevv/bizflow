"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { useCustomers } from "@/lib/customers-store";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomerHistory } from "@/lib/domain/customer-history";
import { formatCurrencyPrecise, formatDate } from "@/lib/utils";
import { effectiveStatus, invoiceAmount, formatDueIn } from "@/lib/invoice-utils";
import {
  getCustomerInvoices,
  getCustomerOutstanding,
  getCustomerTotalPurchases,
} from "@/lib/customer-metrics";

interface CustomerDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { customers, deleteCustomer } = useCustomers();
  const { invoices } = useInvoices();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const customer = customers.find((c) => c.id === id);

  // Employee-sale history (Phase 4 automation attaches purchases
  // automatically). Hooks run before any early return.
  const history = useCustomerHistory();
  const sales = history
    .filter((p) => p.customerId === id)
    .sort((a, b) => b.at.localeCompare(a.at));

  if (!customer) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Customer not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          This customer may have been removed.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/customers")}>
          Back to Customers
        </Button>
      </div>
    );
  }

  const customerInvoices = getCustomerInvoices(customer.id, invoices).sort(
    (a, b) => b.issueDate.localeCompare(a.issueDate),
  );

  const totalPurchases = getCustomerTotalPurchases(customer.id, invoices);
  const outstanding = getCustomerOutstanding(customer.id, invoices);

  // Purchase history: every line item they've been billed for, newest first
  const purchases = customerInvoices
    .filter((inv) => inv.status !== "draft")
    .flatMap((inv) =>
      inv.items.map((item, i) => ({
        key: `${inv.id}-${i}`,
        date: inv.issueDate,
        description: item.description,
        amount: item.quantity * item.unitPrice,
        invoiceNumber: inv.number,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Customers
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="ghost" size="md" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Customer information */}
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
            >
              {initials(customer.name)}
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                {customer.name}
              </h1>
              <div className="mt-1 flex flex-col gap-1 text-sm text-zinc-500 sm:flex-row sm:gap-4">
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-zinc-700"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" />
                  {customer.email}
                </a>
                {customer.phone ? (
                  <a
                    href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex items-center gap-1.5 hover:text-zinc-700"
                  >
                    <Phone aria-hidden className="h-3.5 w-3.5" />
                    {customer.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex gap-8 sm:justify-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Total Purchases
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {formatCurrencyPrecise(totalPurchases)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Owes Now
              </p>
              <p
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  outstanding > 0 ? "text-amber-700" : "text-zinc-900"
                }`}
              >
                {formatCurrencyPrecise(outstanding)}
              </p>
            </div>
          </div>
        </div>

        {outstanding > 0 ? (
          <div className="flex items-start gap-2.5 border-t border-zinc-100 px-5 py-3">
            <TriangleAlert
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
            />
            <p className="text-sm text-zinc-600">
              This customer has unpaid invoices. Total owed:{" "}
              <span className="font-medium text-amber-700">
                {formatCurrencyPrecise(outstanding)}
              </span>
              .
            </p>
          </div>
        ) : (
          <div className="border-t border-zinc-100 px-5 py-3">
            <p className="text-sm text-zinc-500">All invoices paid. Nothing owed.</p>
          </div>
        )}
      </Card>

      {/* Invoices */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Receipt aria-hidden className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">Invoices</h2>
          </div>
          <Link
            href={`/dashboard/invoices/new`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" />
            New invoice
          </Link>
        </div>
        <ul className="divide-y divide-zinc-100">
          {customerInvoices.map((inv) => {
            const status = effectiveStatus(inv);
            const unpaid = status !== "paid";
            return (
              <li key={inv.id}>
                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{inv.number}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)}
                      {unpaid ? (
                        <span
                          className={
                            status === "overdue" ? "text-red-600" : "text-zinc-400"
                          }
                        >
                          {" "}
                          · {formatDueIn(inv.dueDate)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                  <p className="w-24 text-right text-sm font-medium tabular-nums text-zinc-900">
                    {formatCurrencyPrecise(invoiceAmount(inv))}
                  </p>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-300" />
                </Link>
              </li>
            );
          })}
          {customerInvoices.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              No invoices yet. Create one to start tracking what they owe.
            </li>
          ) : null}
        </ul>
      </Card>

      {/* Purchase history */}
      <Card className="mt-5">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5">
          <ShoppingBag aria-hidden className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Purchase History</h2>
        </div>
        <ul className="divide-y divide-zinc-100">
          {sales.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {p.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {formatDate(p.at)} · {p.saleRef} · {p.paymentStatus === "part" ? "Part-paid" : p.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums text-zinc-900">
                {formatCurrencyPrecise(p.total)}
              </p>
            </li>
          ))}
          {purchases.map((p) => (
            <li key={p.key} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{p.description}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {formatDate(p.date)} · {p.invoiceNumber}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums text-zinc-900">
                {formatCurrencyPrecise(p.amount)}
              </p>
            </li>
          ))}
          {purchases.length === 0 && sales.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-zinc-500">
              No purchases yet.
            </li>
          ) : null}
        </ul>
      </Card>

      {editOpen ? <CustomerFormModal customer={customer} onClose={() => setEditOpen(false)} /> : null}
      {deleteOpen ? (
        <DeleteCustomerDialog
          customer={customer}
          onConfirm={() => {
            deleteCustomer(customer.id);
            router.push("/dashboard/customers");
          }}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
