"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Printer, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";
import { loadReceipts } from "@/lib/receipts-db";
import type { ReceiptSnapshot } from "@/lib/types";

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

/**
 * A receipt renders ONLY from its frozen snapshot (Phase 5.9): even if the
 * business, customer, product, or currency changes later, this page shows
 * the transaction exactly as it was.
 */
export default function ReceiptPage({ params }: ReceiptPageProps) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<{
    receiptNumber: string;
    issuedAt: string;
    snapshot: ReceiptSnapshot;
  } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadReceipts().then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") {
        const found = result.receipts.find((r) => r.id === id) ?? null;
        if (found) {
          setReceipt(found);
          setState("ready");
        } else {
          setState("missing");
        }
      } else if (result.kind === "error") {
        setState("error");
        setError(result.message);
      } else {
        setState("missing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handlePrint() {
    window.print();
  }

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-sm text-zinc-500">Loading receipt…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Could not load the receipt</p>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (state === "missing" || !receipt) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Receipt not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          It may have been removed, or this link is out of date.
        </p>
        <Button className="mt-6" onClick={() => history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const s = receipt.snapshot;
  const cur = s.currency;
  const discountAmountValue = s.discount?.amount ?? 0;

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
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={handlePrint}>
            <Printer aria-hidden className="h-4 w-4" />
            Print
          </Button>
          <Button variant="secondary" size="md" onClick={handlePrint}>
            <Download aria-hidden className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Receipt document — frozen snapshot only */}
      <Card className="print:border-0 print:shadow-none">
        <div className="p-6 sm:p-8">
          {/* Header: business + receipt meta */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {s.business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded data-URL
                <img
                  src={s.business.logoUrl}
                  alt=""
                  className="mb-2 h-10 w-10 rounded-lg border border-zinc-200 object-contain"
                />
              ) : null}
              <p className="text-lg font-semibold tracking-tight text-zinc-900">
                {s.business.name}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{s.business.email}</p>
              <p className="text-sm text-zinc-500">{s.business.phone}</p>
              {s.business.address ? (
                <p className="text-sm text-zinc-500">{s.business.address}</p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Receipt</h1>
              <p className="mt-1 text-sm font-medium text-zinc-600">{s.receiptNumber}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <BadgeCheck aria-hidden className="h-4 w-4" />
                Payment received
              </p>
            </div>
          </div>

          {/* Received from + dates */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Received from
              </p>
              <p className="mt-1.5 text-base font-medium text-zinc-900">{s.customer.name}</p>
              <p className="text-sm text-zinc-500">{s.customer.email}</p>
              {s.customer.phone ? (
                <p className="text-sm text-zinc-500">{s.customer.phone}</p>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Receipt date</span>
                <span className="font-medium text-zinc-900">
                  {formatDate(s.payment.paidAt.slice(0, 10))}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Invoice</span>
                <span className="font-medium text-zinc-900">{s.invoice.number}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Currency</span>
                <span className="font-medium text-zinc-900">{cur}</span>
              </div>
            </div>
          </div>

          {/* Payment line */}
          <div className="mt-6 rounded-lg bg-emerald-50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-emerald-800">
                Amount paid
                {s.payment.method ? ` · ${s.payment.method}` : ""}
                {s.payment.note ? ` · ${s.payment.note}` : ""}
              </p>
              <p className="text-xl font-semibold tabular-nums text-emerald-900">
                {formatMoney(s.amountPaid, cur)}
              </p>
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
                {s.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 text-zinc-700">{item.description}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600">{item.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600">
                      {formatMoney(item.unitPrice, cur)}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatMoney(item.lineTotal, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals — all from the snapshot */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(s.subtotal, cur)}</span>
              </div>
              {s.discount ? (
                <div className="flex justify-between text-sm font-medium text-brand-700">
                  <span>
                    Discount{s.discount.type === "percent" ? ` (${s.discount.value}%)` : ""}
                  </span>
                  <span className="tabular-nums">−{formatMoney(discountAmountValue, cur)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
                <span>Invoice Total</span>
                <span className="tabular-nums">{formatMoney(s.total, cur)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Amount paid (this receipt)</span>
                <span className="tabular-nums text-emerald-700">
                  {formatMoney(s.amountPaid, cur)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium text-zinc-900">
                <span>Remaining balance</span>
                <span className="tabular-nums">{formatMoney(s.remainingBalance, cur)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
            Thank you for your payment. Reference {s.invoice.number} · Receipt{" "}
            {s.receiptNumber}.
          </p>
        </div>
      </Card>
    </div>
  );
}
