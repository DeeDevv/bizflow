"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ReceiptText,
  Share2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  useEmployeeTransactions,
} from "@/lib/employee-transactions";
import { formatSaleMoney, type CompletedSale, type PaymentStatus } from "@/lib/employee-sales";
import {
  recordPaymentOnSale,
} from "@/lib/domain/automation";
import {
  PAYMENT_METHOD_LABEL,
  usePaymentEvents,
  type PaymentMethod,
  type PaymentEvent,
} from "@/lib/domain/payment-events";
import {
  downloadReceiptText,
  nativeShareReceipt,
  receiptShareText,
  whatsappShareUrl,
} from "@/lib/domain/receipt";
import { currentEmployeeId } from "@/lib/employee-session";
import { ReceiptDetails } from "./NewSale";
import { cn } from "@/lib/utils";

/**
 * Employee transactions (Phase 3, extended Phase 8.5).
 *
 * Spec §5/§6: the transaction stays open while a balance is outstanding;
 * payments are recorded as individual EVENTS (partial payment first, the
 * balance later) and the receipt reflects money actually received. Digital
 * first: share to WhatsApp or download the receipt — printing optional.
 */

function statusLabel(s: PaymentStatus): string {
  return s === "part" ? "Partially Paid" : s === "paid" ? "Paid" : "Unpaid";
}

function statusClasses(s: PaymentStatus): string {
  return s === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : s === "part"
      ? "bg-amber-50 text-amber-700"
      : "bg-zinc-100 text-zinc-600";
}

/* ---------------- Record Payment dialog (spec §6) ---------------- */

function RecordPaymentDialog({
  sale,
  onClose,
}: {
  sale: CompletedSale;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(sale.balance || ""));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ balance: number; settled: boolean } | null>(null);

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= sale.balance + 0.001;

  async function submit() {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter the amount the customer paid.");
      return;
    }
    if (parsed > sale.balance + 0.001) {
      setError(
        `The payment exceeds the outstanding balance of ${formatSaleMoney(sale.balance)}.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    const result = await recordPaymentOnSale({
      sale,
      amount: parsed,
      method,
      note: note.trim() || undefined,
      actor: { name: currentEmployeeNameSafe(), userId: currentEmployeeId() },
    });
    setBusy(false);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    setDone({ balance: result.balance, settled: result.settled });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record payment"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl">
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-3 text-lg font-semibold text-zinc-900">
              {done.settled ? "Payment complete" : "Payment recorded"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {done.settled
                ? `${sale.reference} is now fully paid.`
                : `Outstanding balance: ${formatSaleMoney(done.balance)}`}
            </p>
            <Button className="mt-5 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Record Payment</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {sale.reference} · balance {formatSaleMoney(sale.balance)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(sale.paymentStatus)}`}
              >
                {statusLabel(sale.paymentStatus)}
              </span>
            </div>

            <label htmlFor="pay-amount" className="mt-4 block text-sm font-medium text-zinc-700">
              Amount received
            </label>
            <input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <div className="mt-2 flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAmount(String(sale.balance))}
              >
                Full balance
              </Button>
            </div>

            <p className="mt-4 text-sm font-medium text-zinc-700">Payment method</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    method === m
                      ? "bg-brand-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                  )}
                >
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>

            <label htmlFor="pay-note" className="mt-4 block text-sm font-medium text-zinc-700">
              Note <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="pay-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Transfer ref 8842"
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />

            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void submit()} disabled={busy || !valid}>
                {busy ? "Recording…" : "Record Payment"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function currentEmployeeNameSafe(): string {
  try {
    const raw = localStorage.getItem("bizmate.employee-session.v1");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state?.name || parsed?.name || "Staff";
  } catch {
    return "Staff";
  }
}

/* ---------------- Digital-first receipt actions (spec §9) ---------------- */

function ShareRow({ sale }: { sale: CompletedSale }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          void nativeShareReceipt(sale).then((used) => {
            if (!used) window.open(whatsappShareUrl(receiptShareText(sale)), "_blank");
          });
        }}
      >
        <Share2 aria-hidden className="h-4 w-4" />
        Share
      </Button>
      <a
        href={whatsappShareUrl(receiptShareText(sale))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-surface px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        WhatsApp
      </a>
      <Button size="sm" variant="secondary" onClick={() => downloadReceiptText(sale)}>
        <ArrowDownToLine aria-hidden className="h-4 w-4" />
        Download
      </Button>
    </div>
  );
}

/* ---------------- Payment events list (spec §6: history preserved) ------- */

function PaymentHistory({ saleRef, total }: { saleRef: string; total: number }) {
  const events = usePaymentEvents();
  const list = useMemo(() => {
    void total;
    return events.filter((e) => e.saleRef === saleRef).sort((a, b) => a.at.localeCompare(b.at));
  }, [events, saleRef, total]);

  if (list.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-zinc-200">
      <p className="border-b border-zinc-100 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Payment history ({list.length} {list.length === 1 ? "payment" : "payments"})
      </p>
      <ul>
        {list.map((e: PaymentEvent) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 border-b border-zinc-50 px-3.5 py-2 last:border-0"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-900">
                {formatSaleMoney(e.amount)} · {PAYMENT_METHOD_LABEL[e.method]}
              </span>
              <span className="block text-xs text-zinc-500">
                {new Date(e.at).toLocaleString("en-US")} · recorded by {e.recordedBy}
                {e.note ? ` · ${e.note}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Main view ---------------- */

export function Transactions() {
  const sales = useEmployeeTransactions();
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [payRef, setPayRef] = useState<string | null>(null);

  const openSale = sales.find((s) => s.reference === openRef) ?? null;
  const paySale = sales.find((s) => s.reference === payRef) ?? null;

  if (openSale) {
    return (
      <div className="mx-auto max-w-md">
        <div className="pb-4">
          <Button variant="ghost" size="sm" onClick={() => setOpenRef(null)}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
            All transactions
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

          <PaymentHistory saleRef={openSale.reference} total={openSale.total} />

          <div className="mt-4 grid gap-2">
            {openSale.balance > 0 ? (
              <Button onClick={() => setPayRef(openSale.reference)}>
                <Wallet aria-hidden className="h-4 w-4" />
                Record Payment · {formatSaleMoney(openSale.balance)} outstanding
              </Button>
            ) : null}
          </div>
          <ShareRow sale={openSale} />
        </Card>
        {paySale && payRef ? (
          <RecordPaymentDialog sale={paySale} onClose={() => setPayRef(null)} />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sales you&apos;ve completed. Outstanding balances can take further
          payments — history is always kept.
        </p>
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
                onClick={() => setOpenRef(s.reference)}
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
                  {s.balance > 0 ? (
                    <p className="text-[11px] tabular-nums text-amber-700">
                      {formatSaleMoney(s.balance)} outstanding
                    </p>
                  ) : null}
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

