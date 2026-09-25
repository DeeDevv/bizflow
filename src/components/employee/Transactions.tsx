"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useEmployeeTransactions,
} from "@/lib/employee-transactions";
import { formatSaleMoney, type CompletedSale } from "@/lib/employee-sales";
import { ReceiptDetails } from "./NewSale";

/**
 * Employee transactions (Phase 3) — the sales this employee completed,
 * newest first. Owner-level financial analytics stay out of here.
 */

function statusLabel(s: CompletedSale["paymentStatus"]): string {
  return s === "part" ? "Part-paid" : s === "paid" ? "Paid" : "Unpaid";
}

function statusClasses(s: CompletedSale["paymentStatus"]): string {
  return s === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : s === "part"
      ? "bg-amber-50 text-amber-700"
      : "bg-zinc-100 text-zinc-600";
}

export function Transactions() {
  const sales = useEmployeeTransactions();
  const [openSale, setOpenSale] = useState<CompletedSale | null>(null);

  if (openSale) {
    return (
      <div className="mx-auto max-w-md">
        <div className="pb-4">
          <Button variant="ghost" size="sm" onClick={() => setOpenSale(null)}>
            ← All transactions
          </Button>
        </div>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              {openSale.reference}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(openSale.paymentStatus)}`}
            >
              {statusLabel(openSale.paymentStatus)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {new Date(openSale.completedAt).toLocaleString("en-US")} · Served by{" "}
            {openSale.employeeName}
          </p>
          <div className="mt-4 rounded-xl border border-zinc-200 p-4">
            <ReceiptDetails sale={openSale} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Sales you&apos;ve completed.</p>
      </div>

      {sales.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <ReceiptText aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">No transactions yet</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Completed sales appear here instantly.
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-surface shadow-card">
          {sales.map((s) => (
            <li key={s.reference}>
              <button
                type="button"
                onClick={() => setOpenSale(s)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {s.reference} · {s.customerName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(s.completedAt).toLocaleString("en-US")} ·{" "}
                    {s.items.reduce((n, i) => n + i.quantity, 0)} item
                    {s.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"} ·{" "}
                    {s.employeeName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">
                    {formatSaleMoney(s.total)}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses(s.paymentStatus)}`}
                  >
                    {statusLabel(s.paymentStatus)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
