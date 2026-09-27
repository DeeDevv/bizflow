"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BanknoteArrowUp,
  Boxes,
  CircleSlash,
  ClipboardList,
  Lightbulb,
  PackageSearch,
  ReceiptText,
  ShoppingBasket,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useBusiness, getBusinessInfo } from "@/lib/business-store";
import { useSetup } from "@/lib/setup-store";
import { useAttentionItems, type AttentionItem } from "@/lib/attention";
import {
  useActivity,
  formatActivityTime,
  type ActivityEntry,
} from "@/lib/activity-store";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import {
  useTodayKpis,
  useInventorySnapshot,
  useTodaySalesPreview,
  useObservations,
  useTeamActivity,
} from "@/lib/domain/owner-overview";
import {
  useDailyBusinessUpdate,
  useReportReadyNotification,
  type DailyUpdateLine,
} from "@/lib/domain/daily-update";

/**
 * Owner Command Center (Phase 6).
 *
 * Answers the three owner questions — "How is my business doing?" (today's
 * KPIs), "What needs my attention?" (the same engine conditions the bell
 * shows), "What is BizMate noticing?" (data-derived observations) — using
 * ONLY existing domain data. No new stores, no invented metrics: every
 * figure traces back to Phase 4 processing, Phase 5 stock state, or the
 * activity system. Empty states everywhere (spec §32–33); nothing fake.
 */

/** The business's own currency, for whole-money formatting. */
function money(value: number): string {
  return formatMoneyWhole(value, getBusinessInfo().currency || "NGN");
}

/* ---------------- Owner header (spec §5–6) ---------------- */

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Greetings don't tick — the value is read on each render. */
const subscribeNoop = (): (() => void) => () => {};

function CommandCenterHeader({ attentionCount }: { attentionCount: number }) {
  const { business } = useBusiness();
  const { setup } = useSetup();

  // Server/client-safe greeting: useSyncExternalStore renders the neutral
  // fallback during SSR/hydration and the real local-time greeting after,
  // without a setState-in-effect (the local clock is an external system).
  const hour = useSyncExternalStore(
    subscribeNoop,
    () => new Date().getHours(),
    () => null,
  );
  const greeting = hour === null ? null : greetingFor(hour);

  return (
    <header className="pb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        {greeting ? `${greeting}, ${setup.owner.name || "there"}` : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {business.name || "Your business"} · Here&apos;s what is happening
        today.
      </p>
      {attentionCount > 0 ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          {attentionCount} {attentionCount === 1 ? "thing needs" : "things need"}{" "}
          your attention
        </p>
      ) : null}
    </header>
  );
}

/* ---------------- Daily Business Update (Phase 8) ---------------- */

const UPDATE_DOT: Record<DailyUpdateLine["severity"], string> = {
  info: "bg-brand-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

function UpdateLine({ line }: { line: DailyUpdateLine }) {
  return (
    <li>
      <Link
        href={line.href}
        className="flex items-start gap-2.5 px-5 py-2.5 hover:bg-zinc-50"
      >
        <span
          aria-hidden
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${UPDATE_DOT[line.severity]}`}
        />
        <span className="min-w-0 text-sm text-zinc-700">{line.text}</span>
      </Link>
    </li>
  );
}

/**
 * The owner's short morning summary (Phase 8): attention, outstanding,
 * yesterday's received. Every figure comes from the shared domain
 * calculations (see daily-update.ts) — this card only renders.
 */
function DailyBusinessUpdate() {
  const update = useDailyBusinessUpdate();

  // Pre-hydration (update === null): keep the card's space with the same
  // height so layout doesn't shift when the real content arrives.
  if (!update) {
    return (
      <Card className="min-h-[172px]" aria-hidden>
        {""}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Your day at a glance"
        subtitle={`${update.dateLabel} · built from your own records`}
        action={
          <Link
            href="/dashboard/report"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            View full report
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="border-t border-zinc-100">
        <dl className="grid grid-cols-3 divide-x divide-zinc-100">
          <div className="px-4 py-3">
            <dt className="text-xs text-zinc-500">Needs attention</dt>
            <dd
              className={`mt-0.5 text-lg font-semibold tabular-nums ${
                update.attentionCount > 0 ? "text-amber-700" : "text-zinc-900"
              }`}
            >
              {update.attentionCount}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-xs text-zinc-500">Outstanding today</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
              {money(update.outstandingToday)}
            </dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-xs text-zinc-500">Received yesterday</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
              {update.hasYesterday ? money(update.yesterdayReceived) : "—"}
            </dd>
            <dd className="text-[11px] text-zinc-400">
              {update.hasYesterday
                ? `${update.yesterdayTransactions} ${
                    update.yesterdayTransactions === 1 ? "transaction" : "transactions"
                  }`
                : "No sales yesterday"}
            </dd>
          </div>
        </dl>
        {update.attention.length > 0 ? (
          <ul className="border-t border-zinc-100">
            {update.attention.map((l) => (
              <UpdateLine key={l.id} line={l} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500">
            All quiet — nothing needs your attention this morning.
          </p>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Quick actions (spec §41 — keep it small) ---------------- */

function QuickActions() {
  const actions: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "New sale", href: "/dashboard/employee/sale", icon: ShoppingBasket },
    { label: "View inventory", href: "/dashboard/employee/inventory", icon: Boxes },
    { label: "Add product", href: "/dashboard/products", icon: PackageSearch },
    { label: "Add employee", href: "/dashboard/settings", icon: UserPlus },
  ];
  return (
    <div>
      <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm font-medium text-zinc-700 shadow-card transition-colors hover:bg-zinc-50"
          >
            <a.icon aria-hidden className="h-4 w-4 text-zinc-400" />
            {a.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/dashboard/report"
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        <ClipboardList aria-hidden className="h-4 w-4" />
        View Today&apos;s Report
        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ---------------- KPI cards (spec §7–9, §24) ---------------- */

function KpiCard({
  label,
  value,
  context,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  context: string;
  icon: LucideIcon;
  note?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">
        {context}
        {note ? ` · ${note}` : ""}
      </p>
    </Card>
  );
}

function KpiGrid() {
  const kpis = useTodayKpis();

  if (!kpis.hasData) {
    return (
      <Card className="px-5 py-6 text-center">
        <p className="text-sm font-medium text-zinc-900">No sales recorded yet</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          Today&apos;s sales, money received, and outstanding balances will
          appear here after your first sale.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Today's sales"
        value={money(kpis.saleValue)}
        context="Today"
        icon={Wallet}
      />
      <KpiCard
        label="Money received"
        value={money(kpis.moneyReceived)}
        context="Today"
        icon={BanknoteArrowUp}
      />
      <KpiCard
        label="Outstanding"
        value={money(kpis.outstanding)}
        context="Today"
        icon={CircleSlash}
        note={kpis.outstanding === 0 ? "Nothing outstanding today" : undefined}
      />
      <KpiCard
        label="Transactions"
        value={String(kpis.transactions)}
        context="Today"
        icon={ReceiptText}
      />
    </div>
  );
}

/* ---------------- Needs your attention (spec §11–14, §37) ---------------- */

/** Clear importance labels instead of numeric scores (spec §12). */
const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  balance: "Payment",
  invoice: "Invoice",
  stock: "Stock",
};

/** Critical business conditions (out of stock) rank above important alerts. */
const SEVERITY_ORDER: Record<NonNullable<AttentionItem["severity"]>, number> = {
  critical: 0,
  important: 1,
};

function attentionLabel(n: AttentionItem): string {
  return n.severity === "critical" ? "Critical" : KIND_LABEL[n.kind];
}

function AttentionIcon({ item }: { item: AttentionItem }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (item.kind === "balance")
    return <BanknoteArrowUp aria-hidden className={`${cls} text-amber-500`} />;
  if (item.kind === "invoice")
    return <ReceiptText aria-hidden className={`${cls} text-amber-500`} />;
  return (
    <PackageSearch
      aria-hidden
      className={`${cls} ${item.severity === "critical" ? "text-red-500" : "text-brand-500"}`}
    />
  );
}

function NeedsAttention() {
  const items = useAttentionItems();

  const ordered = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity ?? "important"] -
          SEVERITY_ORDER[b.severity ?? "important"],
      ),
    [items],
  );

  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        subtitle="Conditions BizMate is watching for you"
      />
      {ordered.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">
          All caught up — nothing needs your attention right now.
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {ordered.map((n) => (
            <li key={n.id} className="border-b border-zinc-50 last:border-0">
              <Link
                href={n.href}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
              >
                <span className="flex min-w-0 gap-3">
                  <AttentionIcon item={n} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {attentionLabel(n)} · {n.detail}
                    </span>
                  </span>
                </span>
                <ArrowRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-zinc-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Inventory snapshot (spec §10, §22) ---------------- */

function InventorySnapshotCard() {
  const snapshot = useInventorySnapshot();

  const valueLine =
    snapshot.value === null
      ? null
      : {
          text: `Inventory value at cost: ${money(snapshot.value.total)}`,
          caveat:
            snapshot.value.missing > 0
              ? `${snapshot.value.missing} ${snapshot.value.missing === 1 ? "product has" : "products have"} no cost price, so this is incomplete.`
              : null,
        };

  return (
    <Card>
      <CardHeader
        title="Inventory"
        subtitle="Current stock across your catalogue"
        action={
          <Link
            href="/dashboard/employee/inventory"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            View inventory
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {snapshot.totalProducts === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">
          No products yet — add your catalogue to start tracking stock.
        </p>
      ) : (
        <div className="border-t border-zinc-100">
          <dl className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4">
            {[
              { label: "Products", value: String(snapshot.totalProducts) },
              { label: "Units in stock", value: String(snapshot.totalUnits) },
              { label: "Running low", value: String(snapshot.lowCount) },
              { label: "Out of stock", value: String(snapshot.outCount) },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <dt className="text-xs text-zinc-500">{s.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          {valueLine ? (
            <p className="border-t border-zinc-50 px-4 py-2.5 text-xs text-zinc-500">
              {valueLine.text}
              {valueLine.caveat ? ` ${valueLine.caveat}` : null}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Today's sales preview (spec §18) ---------------- */

function TodaySalesCard() {
  const preview = useTodaySalesPreview();

  return (
    <Card>
      <CardHeader
        title="Today's sales"
        subtitle={
          preview.rows.length > 0
            ? "What sold today, by product"
            : "Preview of today's transactions"
        }
      />
      {preview.rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">
          No sales recorded yet today.
        </p>
      ) : (
        <div className="border-t border-zinc-100">
          <ul>
            {preview.rows.map((row) => (
              <li
                key={row.productId}
                className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
              >
                <span className="min-w-0 truncate text-sm text-zinc-700">
                  {row.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                  ×{row.quantity}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-zinc-100 px-5 py-2.5 text-xs text-zinc-500">
            {preview.transactionCount}{" "}
            {preview.transactionCount === 1 ? "transaction" : "transactions"} ·{" "}
            {preview.totalUnits} {preview.totalUnits === 1 ? "unit" : "units"} ·{" "}
            {money(preview.salesValue)} sales value
          </p>
        </div>
      )}
    </Card>
  );
}

/* ---------------- BizMate noticed (spec §15, §43) ---------------- */

function BizMateNoticedCard() {
  const observations = useObservations();

  return (
    <Card>
      <CardHeader
        title="BizMate noticed"
        subtitle="Observations from today's business activity"
      />
      {observations.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">Nothing new to report.</p>
      ) : (
        <ul className="border-t border-zinc-100">
          {observations.map((o) => (
            <li key={o.id} className="border-b border-zinc-50 last:border-0">
              <Link
                href={o.href}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
              >
                <span className="flex min-w-0 gap-3">
                  <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0 text-sm text-zinc-700">{o.text}</span>
                </span>
                <ArrowRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-zinc-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Recent activity (spec §16–17) ---------------- */

type ActivityFilter = "all" | "sales" | "inventory";

const FILTER_KINDS: Record<Exclude<ActivityFilter, "all">, ActivityEntry["kind"][]> = {
  sales: ["sale_completed"],
  inventory: ["stock_received", "stock_adjusted"],
};

function RecentActivityCard() {
  const entriesAll = useActivity();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const entries = useMemo(() => {
    if (filter === "all") return entriesAll;
    const kinds = FILTER_KINDS[filter];
    return entriesAll.filter((e) => kinds.includes(e.kind));
  }, [entriesAll, filter]);

  return (
    <Card>
      <CardHeader
        title="Recent activity"
        subtitle="What the team has been doing"
        action={
          <div role="group" aria-label="Filter activity" className="flex gap-1">
            {(["all", "sales", "inventory"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-brand-50 text-brand-700"
                    : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      />
      {entries.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500">
          {filter === "all"
            ? "No activity yet — completed sales, stock movements, and customers will appear here."
            : `No ${filter} activity yet.`}
        </p>
      ) : (
        <ol className="border-t border-zinc-100">
          {entries.slice(0, 8).map((e) => (
            <li
              key={e.id}
              className="flex gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
            >
              <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-zinc-400">
                {formatActivityTime(e.at)}
              </span>
              <p className="min-w-0 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">{e.actor}</span>{" "}
                {e.label}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ---------------- Team activity (spec §20) ---------------- */

function TeamActivityCard() {
  const rows = useTeamActivity();

  return (
    <Card>
      <CardHeader
        title="Team activity"
        subtitle="What the team did today (operational view)"
      />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">
          No team activity yet today.
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Users aria-hidden className="h-4 w-4 shrink-0 text-zinc-300" />
                <span className="truncate text-sm font-medium text-zinc-900">
                  {r.name}
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {[
                  r.sales > 0 ? `${r.sales} ${r.sales === 1 ? "sale" : "sales"}` : null,
                  r.stockMovements > 0
                    ? `${r.stockMovements} stock ${r.stockMovements === 1 ? "movement" : "movements"}`
                    : null,
                  r.customerAdds > 0
                    ? `${r.customerAdds} customer ${r.customerAdds === 1 ? "add" : "adds"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Empty-business welcome (spec §33, §46) ---------------- */

function EmptyBusinessWelcome() {
  return (
    <Card className="px-6 py-10 text-center">
      <ClipboardList aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
      <h2 className="mt-3 text-lg font-semibold text-zinc-900">
        Welcome to BizMate — your business is ready.
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
        Your dashboard will fill in as you work. Start here:
      </p>
      <ol className="mx-auto mt-5 max-w-sm space-y-2 text-left">
        {[
          { text: "Add your products", href: "/dashboard/products" },
          { text: "Add your team members", href: "/dashboard/settings" },
          { text: "Record your first sale", href: "/dashboard/employee/sale" },
        ].map((step, i) => (
          <li key={step.text}>
            <Link
              href={step.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <span>
                <span className="mr-2 text-xs font-semibold text-brand-600 tabular-nums">
                  {i + 1}.
                </span>
                {step.text}
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-300" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------------- Composition (spec §26) ---------------- */

export function CommandCenter() {
  const attention = useAttentionItems();
  const snapshot = useInventorySnapshot();
  const kpis = useTodayKpis();
  const preview = useTodaySalesPreview();

  // Report-ready is raised once per day, from the owner's home surface
  // (idempotent per day — see useReportReadyNotification). No-op for an
  // empty business.
  useReportReadyNotification();

  const isEmptyBusiness =
    snapshot.totalProducts === 0 && !kpis.hasData && preview.transactionCount === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <CommandCenterHeader attentionCount={attention.length} />

      {isEmptyBusiness ? (
        <div className="flex flex-col gap-4 sm:gap-5">
          <QuickActions />
          <EmptyBusinessWelcome />
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          <DailyBusinessUpdate />
          <QuickActions />
          <KpiGrid />
          <NeedsAttention />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <InventorySnapshotCard />
            <TodaySalesCard />
          </div>
          <BizMateNoticedCard />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <RecentActivityCard />
            <TeamActivityCard />
          </div>
          <div className="pb-2 text-right">
            <Link
              href="/dashboard/employee"
              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700"
            >
              Employee view
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
