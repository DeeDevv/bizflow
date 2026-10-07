"use client";

import { useMemo } from "react";
import { ShieldAlert, TrendingUp, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useBusiness } from "@/lib/business-store";
import { formatMoneyWhole, formatMoneyCompact } from "@/lib/currency-symbol";
import { useSetup } from "@/lib/setup-store";
import { useBusinessMetrics } from "@/lib/domain/metrics";
import { hasCapability, actorFromSession } from "@/lib/domain/permissions";
import {
  useFinanceTotals,
  useProductProfitability,
  useFinanceInsights,
  type FinanceTotals,
  type ProductProfitRow,
} from "@/lib/domain/finance";
import { useEmployeeSession } from "@/lib/employee-session";

/**
 * Owner-only Financial Overview (Phase 8.6, spec §7/§8).
 *
 * One shared domain calculation (finance module) feeds every figure here —
 * nothing on this page recalculates on its own. Potential profit and actual
 * gross profit are labeled separately (spec §10): potential is stock on
 * hand × price, NOT money earned.
 *
 * The guard is capability-based (spec §17): the page checks viewProfits for
 * the current session and shows a plain "Owner only" state otherwise, so a
 * manager/employee following a direct link (or manipulating client state)
 * never sees cost or profit.
 */

export default function FinancePage() {
  const session = useEmployeeSession();
  const { business } = useBusiness();
  const { setup } = useSetup();

  const money = (v: number) => formatMoneyWhole(v, business.currency || "NGN");
  const compact = (v: number) => formatMoneyCompact(v, business.currency || "NGN");

  // Capability guard (spec §17): owner actor only. Sessions never carry
  // viewProfits when an employee role is active.
  const allowed = useMemo(
    () => hasCapability(actorFromSession(session), "viewProfits"),
    [session],
  );

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert aria-hidden className="h-6 w-6 text-amber-600" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-zinc-900">
            Financials are owner-only
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Costs and profit are private to the business owner. Staff views show
            sales and stock, never margins.
          </p>
        </Card>
      </div>
    );
  }

  return <OwnerFinancialOverview money={money} compact={compact} capital={setup.startingCapital} />;
}

function OwnerFinancialOverview({
  money,
  compact,
  capital,
}: {
  money: (v: number) => string;
  compact: (v: number) => string;
  capital: number | null;
}) {
  const totals: FinanceTotals = useFinanceTotals();
  const rows: ProductProfitRow[] = useProductProfitability();
  const { bestSeller, mostProfitable } = useFinanceInsights();
  // Money Received / Outstanding (spec §7): the metrics store keeps the
  // received-vs-billed split; profit stays ledger-based (spec §5).
  const metrics = useBusinessMetrics();

  return (
    <div className="min-w-0">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Business Financial Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your private view — staff never see costs or profits.
        </p>
      </div>

      {/* Overview figures (spec §7). */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Overview</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Figure label="Starting Capital" value={capital === null ? "—" : money(capital)} />
          <Figure label="Inventory Cost Value" value={money(totals.inventoryCostValue)} />
          <Figure label="Sales Revenue" value={money(totals.revenue)} />
          <Figure label="Money Received" value={money(metrics.moneyReceived)} />
          <Figure label="Outstanding Customer Payments" value={money(metrics.outstanding)} />
          <Figure label="Gross Profit (actual)" value={money(totals.grossProfit)} emphasize />
        </dl>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-5 text-zinc-500">
          Money received and outstanding update as payments come in; gross profit
          counts every completed sale at full value — not what has been paid so far.
        </p>
        {totals.revenue !== metrics.saleValue ? (
          <p className="mt-2 text-xs leading-5 text-amber-600">
            Note: recorded sales total differs slightly from the sales ledger —
            the profit figures above use the stock ledger.
          </p>
        ) : null}
      </Card>

      {/* Potential figures (spec §4/§10) — clearly labeled, never "earned". */}
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Stock Potential</h2>
        <p className="mt-1 text-xs text-zinc-500">
          If everything in stock sells at current prices — not money in hand.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Figure label="Stock on hand" value={`${totals.unitsOnHand} units`} />
          <Figure label="Potential Sales" value={compact(totals.potentialSales)} />
          <Figure label="Potential Profit" value={compact(totals.potentialProfit)} />
        </dl>
      </Card>

      {/* Per-product profitability (spec §8). */}
      <Card className="mt-5 overflow-hidden p-0">
        <div className="p-5 sm:p-6 sm:pb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Profitability by Product</h2>
          <p className="mt-1 text-xs text-zinc-500">All-time sales and realized profit.</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-zinc-500 sm:px-6">
            No stock movements yet — profitability appears as you receive stock and
            make sales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-zinc-100 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5 font-semibold sm:px-6">Product</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Sold</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.productId} className="text-zinc-700">
                    <td className="max-w-[200px] truncate px-5 py-3 font-medium text-zinc-900 sm:px-6">
                      {r.name}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.soldUnits}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{compact(r.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{compact(r.cogs)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {r.revenue > 0 ? compact(r.grossProfit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Headline insights (spec §8). */}
      {bestSeller || mostProfitable ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <TrendingUp aria-hidden className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Best-selling</h2>
            </div>
            {bestSeller ? (
              <p className="mt-2 text-sm text-zinc-700">
                <span className="font-semibold">{bestSeller.name}</span> — {bestSeller.soldUnits}{" "}
                sold, {money(bestSeller.revenue)} in sales.
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No sales yet.</p>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Trophy aria-hidden className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Most profitable</h2>
            </div>
            {mostProfitable ? (
              <p className="mt-2 text-sm text-zinc-700">
                <span className="font-semibold">{mostProfitable.name}</span> —{" "}
                {money(mostProfitable.grossProfit)} gross profit on {mostProfitable.soldUnits} sold.
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No profit yet.</p>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd
        className={
          emphasize
            ? "mt-0.5 text-xl font-semibold tabular-nums text-emerald-700"
            : "mt-0.5 text-lg font-semibold tabular-nums text-zinc-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}
