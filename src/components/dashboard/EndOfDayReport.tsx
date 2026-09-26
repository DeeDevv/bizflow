"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BanknoteArrowUp,
  CircleSlash,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StockStatusPill } from "@/components/employee/StockStatusPill";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { getBusinessInfo } from "@/lib/business-store";
import { formatActivityTime } from "@/lib/activity-store";
import {
  useEndOfDayReport,
  reportMethodLabel,
  type EndOfDayReport,
  type ReportTransaction,
} from "@/lib/domain/end-of-day-report";

/**
 * End-of-Day Business Report (Phase 7) — presentation layer.
 *
 * Renders the STRUCTURED REPORT from the domain module; every number shown
 * was computed there (one source, deterministic). The layout is a document,
 * not a dashboard: header → summary → sales → payments → outstanding →
 * current stock → stock activity → footer. Sections stack vertically so a
 * future print/PDF version can reuse the same structure directly.
 */

const money = (value: number): string =>
  formatMoneyWhole(value, getBusinessInfo().currency || "NGN");

const STATUS_LABEL: Record<ReportTransaction["paymentStatus"], string> = {
  paid: "Paid",
  part: "Part-paid",
  unpaid: "Unpaid",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h2>
  );
}

function ReportHeader({ report }: { report: EndOfDayReport }) {
  return (
    <header className="px-6 pb-5 pt-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-900">
        {report.business.name}
      </p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
        End-of-Day Business Report
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{report.date.label}</p>
    </header>
  );
}

function ReportSummary({ report }: { report: EndOfDayReport }) {
  const { summary } = report;
  const stats = [
    { label: "Sales Value", value: money(summary.salesValue), icon: Wallet },
    {
      label: "Money Received",
      value: money(summary.moneyReceived),
      icon: BanknoteArrowUp,
    },
    { label: "Outstanding", value: money(summary.outstanding), icon: CircleSlash },
    {
      label: "Transactions",
      value: String(summary.transactionCount),
      icon: ReceiptText,
    },
  ];
  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Today&apos;s Summary</SectionTitle>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
              <s.icon aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
              {s.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-zinc-400">
        Outstanding = sales value minus money actually received today.
      </p>
    </section>
  );
}

function TransactionDetails({ transactions }: { transactions: ReportTransaction[] }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700">
        Transactions ({transactions.length}) — times, customers, references
      </summary>
      <ol className="mt-3 space-y-3">
        {transactions.map((t) => (
          <li
            key={t.reference}
            className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm font-semibold text-zinc-900">
                {t.reference}
              </span>
              <span className="text-xs tabular-nums text-zinc-400">
                {formatActivityTime(t.completedAt)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Served by {t.employeeName} · {t.customerName} ·{" "}
              {STATUS_LABEL[t.paymentStatus]}
              {t.method ? ` · ${reportMethodLabel(t.method)}` : ""}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {t.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex justify-between gap-3 text-xs text-zinc-600"
                >
                  <span className="min-w-0 truncate">
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </span>
                  <span className="tabular-nums">{money(item.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 border-t border-zinc-100 pt-1.5 text-xs text-zinc-500">
              Total {money(t.total)} · Paid {money(t.amountPaid)}
              {t.balance > 0 ? ` · Balance ${money(t.balance)}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function ReportSales({ report }: { report: EndOfDayReport }) {
  const { summary, productRows, transactions } = report;
  const totalUnits = productRows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Today&apos;s Sales</SectionTitle>
      {!summary.hasSales ? (
        <p className="mt-3 text-sm text-zinc-500">No sales recorded today.</p>
      ) : (
        <>
          <ol className="mt-3 space-y-2">
            {productRows.map((row, index) => (
              <li key={row.productId} className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-300">
                  {index + 1}.
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-zinc-900">
                  {row.name}
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    Qty {row.quantity}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-zinc-700">
                  {money(row.total)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-zinc-400">
            {summary.transactionCount}{" "}
            {summary.transactionCount === 1 ? "transaction" : "transactions"} ·{" "}
            {totalUnits} {totalUnits === 1 ? "unit" : "units"} sold
          </p>
          <TransactionDetails transactions={transactions} />
        </>
      )}
    </section>
  );
}

function ReportPayments({ report }: { report: EndOfDayReport }) {
  const { paymentTotals, paymentStatusCounts, summary } = report;
  const methodEntries = (Object.entries(paymentTotals) as [
    keyof typeof paymentTotals,
    number,
  ][]).sort((a, b) => b[1] - a[1]);
  const missingMethod = transactionsMissingMethod(report);

  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Payments</SectionTitle>
      <dl className="mt-3 space-y-1.5">
        {methodEntries.map(([method, amount]) => (
          <div key={method} className="flex justify-between gap-3 text-sm">
            <dt className="text-zinc-600">{reportMethodLabel(method)}</dt>
            <dd className="tabular-nums text-zinc-900">{money(amount)}</dd>
          </div>
        ))}
        {missingMethod ? (
          <p className="text-xs text-zinc-400">
            Some transactions have no payment method recorded.
          </p>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-zinc-100 pt-1.5 text-sm font-semibold">
          <dt className="text-zinc-900">Total Received</dt>
          <dd className="tabular-nums text-zinc-900">
            {money(summary.moneyReceived)}
          </dd>
        </div>
      </dl>
      {methodEntries.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-400">
          No payment methods were recorded on today&apos;s transactions.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-zinc-500">
        {(
          [
            ["paid", "Paid"],
            ["part", "Part-paid"],
            ["unpaid", "Unpaid"],
          ] as const
        )
          .filter(([key]) => (paymentStatusCounts[key] ?? 0) > 0)
          .map(([key, label]) => `${label} ${paymentStatusCounts[key]}`)
          .join(" · ")}
      </p>
    </section>
  );
}

function transactionsMissingMethod(report: EndOfDayReport): boolean {
  return report.transactions.some((t) => t.method === null);
}

function ReportOutstanding({ report }: { report: EndOfDayReport }) {
  const { outstanding, summary } = report;
  if (!summary.hasSales) return null;

  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Outstanding</SectionTitle>
      {outstanding.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No outstanding payments today.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {outstanding.map((row) => (
              <li key={row.reference} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-zinc-900">
                  {row.customerName}
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    {row.productSummary} · {row.reference}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700">
                  {money(row.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between gap-3 border-t border-zinc-100 pt-2 text-sm font-semibold">
            <span className="text-zinc-900">Total Outstanding</span>
            <span className="tabular-nums text-zinc-900">
              {money(summary.outstanding)}
            </span>
          </p>
        </>
      )}
    </section>
  );
}

function ReportInventory({ report }: { report: EndOfDayReport }) {
  const { inventorySummary, inventory } = report;
  const value = inventorySummary.value;

  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Current Stock</SectionTitle>
      <p className="mt-1 text-xs text-zinc-400">
        Current stock after today&apos;s recorded activity — the complete
        catalogue, including products not touched today.
      </p>

      {inventorySummary.totalProducts === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No products have been added yet.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
              { label: "Products", value: String(inventorySummary.totalProducts) },
              { label: "Units", value: String(inventorySummary.totalUnits) },
              { label: "Low Stock", value: String(inventorySummary.lowCount) },
              { label: "Out of Stock", value: String(inventorySummary.outCount) },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
                <dd className="text-base font-semibold tabular-nums text-zinc-900">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          {value ? (
            <p className="mt-3 text-xs text-zinc-500">
              Inventory value at cost:{" "}
              <span className="font-semibold tabular-nums text-zinc-900">
                {money(value.total)}
              </span>
              {value.missing > 0
                ? ` — excludes ${value.missing} ${
                    value.missing === 1 ? "product" : "products"
                  } without cost prices.`
                : ""}
            </p>
          ) : null}

          <div className="mt-4 space-y-4">
            {inventory.map((group) => (
              <div key={group.category}>
                <h3 className="text-xs font-semibold text-zinc-700">
                  {group.category}
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {group.products.map((p) => (
                    <li
                      key={p.productId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-zinc-900">
                        {p.name}
                        {p.code !== "—" ? (
                          <span className="ml-2 text-xs text-zinc-400">
                            {p.code}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-700">
                        {p.stock}
                      </span>
                      <StockStatusPill status={p.status} label={p.statusLabel} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ReportStockActivity({ report }: { report: EndOfDayReport }) {
  const { stockActivity } = report;
  if (!stockActivity.hasAny) return null;

  return (
    <section className="border-t border-zinc-100 px-6 py-5">
      <SectionTitle>Stock Activity Today</SectionTitle>
      <dl className="mt-3 space-y-1.5 text-sm">
        {stockActivity.receivedEvents > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">
              Stock received ({stockActivity.receivedEvents}{" "}
              {stockActivity.receivedEvents === 1 ? "delivery" : "deliveries"})
            </dt>
            <dd className="tabular-nums text-emerald-700">
              +{stockActivity.receivedUnits} units
            </dd>
          </div>
        ) : null}
        {stockActivity.soldUnits > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">Units sold</dt>
            <dd className="tabular-nums text-zinc-900">
              −{stockActivity.soldUnits} units
            </dd>
          </div>
        ) : null}
        {stockActivity.adjustments !== 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">Adjustments</dt>
            <dd className="tabular-nums text-zinc-900">
              {stockActivity.adjustments > 0 ? "+" : ""}
              {stockActivity.adjustments} units
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function ReportFooter({ report }: { report: EndOfDayReport }) {
  return (
    <footer className="border-t border-zinc-100 px-6 py-4 text-center text-xs text-zinc-400">
      Generated by BizMate · {formatActivityTime(report.generatedAt)}
      {report.date.isToday ? " · today" : ""}
    </footer>
  );
}

function ReportToolbar() {
  return (
    <div className="flex items-center justify-between gap-3 pb-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Command Center
      </Link>
      <span
        title="Report delivery (WhatsApp, PDF, email) arrives in a later phase"
        className="cursor-not-allowed inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-300"
        aria-disabled="true"
      >
        Send to WhatsApp · coming later
      </span>
    </div>
  );
}

/** The full report document. Consumes the structured model — nothing here calculates. */
export function EndOfDayReportView() {
  const report = useEndOfDayReport();

  const sections = useMemo(
    () => (
      <>
        <ReportHeader report={report} />
        <ReportSummary report={report} />
        <ReportSales report={report} />
        {report.summary.hasSales ? <ReportPayments report={report} /> : null}
        <ReportOutstanding report={report} />
        <ReportInventory report={report} />
        <ReportStockActivity report={report} />
        <ReportFooter report={report} />
      </>
    ),
    [report],
  );

  return (
    <div>
      <ReportToolbar />
      <Card className="overflow-hidden">{sections}</Card>
      <p className="pt-3 text-right">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          Back to Command Center
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </p>
    </div>
  );
}
