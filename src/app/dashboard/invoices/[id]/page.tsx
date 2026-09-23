"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Pencil,
  Printer,
  Download,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useInvoices } from "@/lib/invoices-store";
import { useCustomers } from "@/lib/customers-store";
import { formatDate, cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";
import { effectiveStatus, invoiceAmount, invoiceSubtotal, discountAmount, formatDueIn } from "@/lib/invoice-utils";
import { useBusiness } from "@/lib/business-store";

interface InvoiceDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function InvoiceDetailsPage({ params }: InvoiceDetailsPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const {
    invoices,
    markAsPaid,
    payments,
    paidFor,
    recordPayment,
    error: dbError,
    clearError,
  } = useInvoices();
  const { customers } = useCustomers();
  const { business: businessInfo } = useBusiness();
  // True while the atomic finalize (paid + stock deduction) is in flight.
  const [finalizing, setFinalizing] = useState(false);

  // Record-a-payment form (Phase 5.8).
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [recording, setRecording] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === id),
    [invoices, id],
  );
  const customer = customers.find((c) => c.id === invoice?.customerId);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Invoice not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          It may have been removed, or this link is out of date.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/invoices")}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  const status = effectiveStatus(invoice);
  const amount = invoiceAmount(invoice);
  const discount = discountAmount(invoice.discount, invoiceSubtotal(invoice.items));

  // Payment status from real payment records (Phase 5.8).
  const paidSoFar = paidFor(invoice.id);
  const remaining = Math.max(0, Math.round((amount - paidSoFar) * 100) / 100);
  const invoicePayments = payments.filter((p) => p.invoiceId === invoice.id);

  const field =
    "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  async function handleMarkAsPaid() {
    if (!invoice || finalizing) return;
    setFinalizing(true);
    // Atomic finalize_invoice_sale: marks paid AND deducts product stock in
    // one transaction. Repeated calls are no-ops in the database, so this
    // can never double-deduct. The store rolls back + shows an error if the
    // database refuses (e.g. not enough stock).
    await markAsPaid(invoice.id);
    setFinalizing(false);
  }

  async function handleRecordPayment() {
    if (!invoice || recording) return;
    const value = Number.parseFloat(payAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setPayError("Enter an amount greater than zero.");
      return;
    }
    if (value > remaining + 0.001) {
      setPayError(
        `That is more than the remaining balance (${formatMoney(remaining, businessInfo.currency)}).`,
      );
      return;
    }
    setPayError(null);
    setRecording(true);
    // The database validates everything again atomically (remaining
    // balance, positive amount) — a rejected payment changes nothing.
    const result = await recordPayment(invoice.id, value, payNote);
    setRecording(false);
    if (result.ok) {
      setPayAmount("");
      setPayNote("");
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleSaveAsPdf() {
    // The browser's print dialog offers "Save as PDF" as a destination —
    // no PDF library needed.
    window.print();
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back + actions */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Invoices
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/dashboard/invoices/${invoice.id}/edit`)}
          >
            <Pencil aria-hidden className="h-4 w-4" />
            Edit
          </Button>
          {status !== "paid" ? (
            <Button size="md" onClick={handleMarkAsPaid} disabled={finalizing}>
              <Check aria-hidden className="h-4 w-4" />
              {finalizing ? "Saving…" : "Mark as Paid"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <BadgeCheck aria-hidden className="h-4 w-4" />
              Paid
            </span>
          )}
          <Button variant="secondary" size="md" onClick={handlePrint}>
            <Printer aria-hidden className="h-4 w-4" />
            Print
          </Button>
          <Button variant="secondary" size="md" onClick={handleSaveAsPdf}>
            <Download aria-hidden className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Database save errors (e.g. not enough stock to complete the sale) */}
      {dbError ? (
        <div
          role="alert"
          className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>{dbError}</span>
          <button
            type="button"
            onClick={clearError}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Invoice document */}
      <Card className="print:border-0 print:shadow-none">
        <div className="p-6 sm:p-8">
          {/* Header: business + invoice meta */}
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
              <p className="text-sm text-zinc-500">{businessInfo.phone}</p>
              {businessInfo.address ? (
                <p className="text-sm text-zinc-500">{businessInfo.address}</p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Invoice</h1>
              <p className="mt-1 text-sm font-medium text-zinc-600">{invoice.number}</p>
              <div className="mt-2 flex sm:justify-end">
                <StatusBadge status={status} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {status === "paid"
                  ? "Paid — thank you!"
                  : `Due ${formatDate(invoice.dueDate)} (${formatDueIn(invoice.dueDate)})`}
              </p>
            </div>
          </div>

          {/* Bill-to + dates */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Bill to</p>
              <p className="mt-1.5 text-base font-medium text-zinc-900">
                {customer?.name ?? "Unknown customer"}
              </p>
              <p className="text-sm text-zinc-500">{customer?.email}</p>
              <p className="text-sm text-zinc-500">{customer?.phone}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Issued</span>
                <span className="font-medium text-zinc-900">{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Due</span>
                <span className="font-medium text-zinc-900">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Terms</span>
                <span className="font-medium text-zinc-900">Due on receipt</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mt-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Items</th>
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
                      {formatMoney(item.unitPrice, businessInfo.currency)}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatMoney(item.quantity * item.unitPrice, businessInfo.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatMoney(invoiceSubtotal(invoice.items), businessInfo.currency)}
                </span>
              </div>
              {discount ? (
                <div className="flex justify-between text-sm font-medium text-brand-700">
                  <span>
                    Discount{invoice.discount?.type === "percent" ? ` (${invoice.discount.value}%)` : ""}
                  </span>
                  <span className="tabular-nums">−{formatMoney(discount, businessInfo.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <span>Final Total</span>
                <span className="tabular-nums">{formatMoney(amount, businessInfo.currency)}</span>
              </div>
              {paidSoFar > 0 ? (
                <>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Paid so far</span>
                    <span className="tabular-nums text-emerald-700">
                      {formatMoney(paidSoFar, businessInfo.currency)}
                    </span>
                  </div>
                  {remaining > 0 && status !== "paid" ? (
                    <div className="flex justify-between text-sm font-medium text-amber-700">
                      <span>Remaining</span>
                      <span className="tabular-nums">
                        {formatMoney(remaining, businessInfo.currency)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {/* Payments received — real records from Supabase (Phase 5.8) */}
          {invoicePayments.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Payments received
              </p>
              <ul className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100">
                {invoicePayments.map((pay) => (
                  <li
                    key={pay.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-zinc-600">
                      {formatDate(pay.paidAt.slice(0, 10))}
                      {pay.note ? <span className="text-zinc-400"> · {pay.note}</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="font-medium tabular-nums text-emerald-700">
                        {formatMoney(pay.amount, businessInfo.currency)}
                      </span>
                      <a
                        href={`/dashboard/receipts/new?payment=${pay.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700"
                      >
                        Receipt
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Record a payment (Phase 5.8) */}
          {remaining > 0 && status !== "paid" ? (
            <div className="no-print mt-6 rounded-lg border border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-900">Record a payment</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {formatMoney(remaining, businessInfo.currency)} still owed on this invoice.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <label htmlFor="payment-amount" className="text-xs font-medium text-zinc-600">
                    Amount
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className={cn(field, "tabular-nums")}
                  />
                </div>
                <div className="min-w-44 flex-1">
                  <label htmlFor="payment-note" className="text-xs font-medium text-zinc-600">
                    Note <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="payment-note"
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. Bank transfer"
                    className={field}
                  />
                </div>
                <Button onClick={handleRecordPayment} disabled={recording}>
                  {recording ? "Saving…" : "Record Payment"}
                </Button>
              </div>
              {payError ? (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {payError}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Footer note */}
          <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
            Please reference {invoice.number} with your payment.
          </p>
        </div>
      </Card>
    </div>
  );
}
