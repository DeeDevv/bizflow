"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { formatCurrencyPrecise, formatDate } from "@/lib/utils";
import { invoiceSubtotal, discountAmount } from "@/lib/invoice-utils";
import { useBusiness } from "@/lib/business-store";

interface SaleDetailsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Sale details = a paid invoice viewed as a completed transaction.
 * Shares its data with the invoice record, so the numbers always agree.
 */
export default function SaleDetailsPage({ params }: SaleDetailsPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { invoices } = useInvoices();
  const { customers } = useCustomers();
  const { business: businessInfo } = useBusiness();

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === id && inv.status === "paid"),
    [invoices, id],
  );
  const customer = customers.find((c) => c.id === invoice?.customerId);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Sale not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          It may not be paid yet, or this link is out of date.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/sales")}>
          Back to Sales
        </Button>
      </div>
    );
  }

  const subtotal = invoiceSubtotal(invoice.items);
  const discount = discountAmount(invoice.discount, subtotal);
  const saleDate = invoice.paidAt ?? invoice.dueDate;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link
          href="/dashboard/sales"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Sales
        </Link>
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
        >
          <FileText aria-hidden className="h-4 w-4" />
          View Invoice
        </Button>
      </div>

      {/* Sale record */}
      <Card>
        <div className="p-6 sm:p-8">
          {/* Header: business + sale meta */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {businessInfo.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded data-URL
                <img
                  src={businessInfo.logoUrl}
                  alt=""
                  className="mb-2 h-10 w-10 rounded-lg border border-zinc-200 object-contain"
                />
              ) : null}
              <p className="text-lg font-semibold tracking-tight text-zinc-900">
                {businessInfo.name}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{businessInfo.email}</p>
              <p className="text-zinc-500">{businessInfo.phone}</p>
              {businessInfo.address ? (
                <p className="text-sm text-zinc-500">{businessInfo.address}</p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sale</h1>
              <p className="mt-1 text-sm font-medium text-zinc-600">{invoice.number}</p>
              <div className="mt-2 flex sm:justify-end">
                <StatusBadge status="paid" />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Received {formatDate(saleDate)}
              </p>
            </div>
          </div>

          {/* Bill-to + dates */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Customer
              </p>
              <p className="mt-1.5 text-base font-medium text-zinc-900">
                {customer?.name ?? "Unknown customer"}
              </p>
              <p className="text-sm text-zinc-500">{customer?.email}</p>
              <p className="text-sm text-zinc-500">{customer?.phone}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Date of sale</span>
                <span className="font-medium text-zinc-900">{formatDate(saleDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Invoice</span>
                <Link
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {invoice.number}
                </Link>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Payment</span>
                <span className="font-medium text-zinc-900">Paid in full</span>
              </div>
            </div>
          </div>

          {/* Items purchased */}
          <div className="mt-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Items purchased</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Price</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 text-zinc-700">{item.description}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600">{item.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600">
                      {formatCurrencyPrecise(item.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatCurrencyPrecise(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary: Subtotal → Discount → Final Total */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrencyPrecise(subtotal)}</span>
              </div>
              {invoice.discount ? (
                <div className="flex justify-between text-sm font-medium text-brand-700">
                  <span>
                    Discount{invoice.discount.type === "percent" ? ` (${invoice.discount.value}%)` : ""}
                  </span>
                  <span className="tabular-nums">−{formatCurrencyPrecise(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <span>Final Total</span>
                <span className="tabular-nums">{formatCurrencyPrecise(subtotal - discount)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
            Payment for {invoice.number} was received in full — thank you!
          </p>
        </div>
      </Card>
    </div>
  );
}
