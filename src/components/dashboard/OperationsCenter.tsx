"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  MapPin,
  PackageSearch,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useBusiness } from "@/lib/business-store";
import { useProducts } from "@/lib/products-store";
import { useEmployeeTransactions } from "@/lib/employee-transactions";
import { computeInventorySnapshot } from "@/lib/domain/owner-overview";
import { useTeamActivity } from "@/lib/domain/owner-overview";
import { formatActivityTime } from "@/lib/activity-store";
import {
  ATTENDANCE_STATUS_LABEL,
  useAttendance,
  type AttendanceStatus,
} from "@/lib/domain/attendance";
import {
  completeFollowUp,
  followUpStatus,
  groupFollowUps,
  useFollowUps,
} from "@/lib/domain/follow-ups";
import { usePaymentEvents, PAYMENT_METHOD_LABEL } from "@/lib/domain/payment-events";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { cn } from "@/lib/utils";

/**
 * Manager Operations Center (Phase 8.5, spec §1 MANAGER).
 *
 * The manager's ONE page for keeping the business data accurate: alerts
 * (low/out stock, pending orders), the follow-up board (due / upcoming /
 * overdue / completed), team attendance with verification status, team
 * activity, and the latest recorded payments. Every figure reuses the
 * shared domain calculations — nothing is re-derived here.
 */

const money = (v: number, currency: string) => formatMoneyWhole(v, currency || "NGN");

const STATUS_CHIP: Record<AttendanceStatus, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  outside_workplace: "bg-red-50 text-red-700",
  unable_to_verify: "bg-amber-50 text-amber-700",
};

/* ---------------- Follow-up board (spec §10) ---------------- */

type Board = "due" | "overdue" | "upcoming" | "completed";

function FollowUpBoard() {
  const tasks = useFollowUps();
  const [board, setBoard] = useState<Board>("due");
  const groups = useMemo(() => groupFollowUps(tasks), [tasks]);
  const list = groups[board];

  const TABS: { key: Board; label: string; count: number }[] = [
    { key: "overdue", label: "Overdue", count: groups.overdue.length },
    { key: "due", label: "Due", count: groups.due.length },
    { key: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { key: "completed", label: "Completed", count: groups.completed.length },
  ];

  return (
    <Card>
      <CardHeader
        title="Customer follow-ups"
        subtitle="Created automatically from purchases and pending orders"
      />
      <div className="flex gap-1 border-t border-zinc-100 px-5 py-2.5" role="group" aria-label="Follow-up status">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={board === t.key}
            onClick={() => setBoard(t.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              board === t.key
                ? "bg-brand-600 text-white"
                : "text-zinc-500 hover:bg-zinc-100",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500">
          {board === "due"
            ? "Nothing due today."
            : board === "overdue"
              ? "Nothing overdue — good."
              : board === "upcoming"
                ? "No scheduled follow-ups ahead."
                : "No completed follow-ups yet."}
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {list.slice(0, 6).map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {f.summary}
                </span>
                <span className="block text-xs text-zinc-500">
                  {f.ruleId === "purchase"
                    ? "After purchase"
                    : f.ruleId === "satisfaction"
                      ? "Satisfaction"
                      : f.ruleId === "pending_order"
                        ? "Pending order"
                        : "Manual"}{" "}
                  · due {new Date(f.dueAt).toLocaleDateString("en-US")}
                  {f.assignedTo ? ` · ${f.assignedTo}` : ""}
                </span>
              </span>
              {f.completedAt ? (
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => completeFollowUp(f.id)}
                  className="shrink-0"
                >
                  Mark done
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Attendance (spec §3: records visible to Manager) ------- */

function AttendanceCard() {
  const records = useAttendance();

  // Today's attempts, newest first, per employee.
  const todays = useMemo(() => {
    const key = new Date();
    const day = `${key.getFullYear()}-${key.getMonth()}-${key.getDate()}`;
    return records
      .filter((r) => {
        const d = new Date(r.at);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === day;
      })
      .slice(0, 8);
  }, [records]);

  return (
    <Card>
      <CardHeader
        title="Team attendance"
        subtitle="Workplace Attendance Verification — today"
      />
      {todays.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 pb-5 text-sm text-zinc-500">
          No one has started work yet today.
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {todays.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <MapPin
                  aria-hidden
                  className={cn(
                    "h-4 w-4 shrink-0",
                    r.status === "verified"
                      ? "text-emerald-600"
                      : r.status === "outside_workplace"
                        ? "text-red-500"
                        : "text-amber-500",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">
                    {r.employeeName} · {r.kind === "start_work" ? "started" : "ended"} work
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {formatActivityTime(r.at)}
                    {r.distanceMeters !== null
                      ? ` · ${
                          r.distanceMeters >= 1000
                            ? `${(r.distanceMeters / 1000).toFixed(1)}km`
                            : `${r.distanceMeters}m`
                        } from workplace`
                      : r.failureReason
                        ? ` · ${r.failureReason}`
                        : ""}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  STATUS_CHIP[r.status],
                )}
              >
                {ATTENDANCE_STATUS_LABEL[r.status].split(" — ")[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Latest payments ---------------- */

function PaymentsCard({ currency }: { currency: string }) {
  const events = usePaymentEvents();
  const latest = events.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Latest payments"
        subtitle="Money actually received, one event per payment"
        action={
          <Link
            href="/dashboard/employee/transactions"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            All transactions
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {latest.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 pb-5 text-sm text-zinc-500">
          No payments recorded yet.
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {latest.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 border-b border-zinc-50 px-5 py-2.5 last:border-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {e.saleRef} · {PAYMENT_METHOD_LABEL[e.method]}
                </span>
                <span className="block text-xs text-zinc-500">
                  {formatActivityTime(e.at)} · recorded by {e.recordedBy}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                {money(e.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Team activity (reuse) ---------------- */

function TeamActivityCard() {
  const rows = useTeamActivity();

  return (
    <Card>
      <CardHeader title="Team activity" subtitle="What the team did today" />
      {rows.length === 0 ? (
        <p className="border-t border-zinc-100 px-5 pb-5 text-sm text-zinc-500">
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
                <span className="truncate text-sm font-medium text-zinc-900">{r.name}</span>
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

/* ---------------- Main ---------------- */

export function OperationsCenter() {
  const { business } = useBusiness();
  const { products } = useProducts();
  const transactions = useEmployeeTransactions();

  const snapshot = useMemo(() => computeInventorySnapshot(products), [products]);
  const pending = useMemo(
    () => transactions.filter((t) => t.balance > 0),
    [transactions],
  );
  const pendingValue = useMemo(
    () => pending.reduce((sum, t) => sum + t.balance, 0),
    [pending],
  );
  const followUps = useFollowUps();
  const overdueFollowUps = useMemo(
    () => followUps.filter((f) => followUpStatus(f) === "overdue").length,
    [followUps],
  );

  const alerts = [
    {
      label: "Low stock",
      value: snapshot.lowCount,
      href: "/dashboard/employee/inventory",
      icon: AlertTriangle,
      tone: snapshot.lowCount > 0 ? "text-amber-600" : "text-zinc-400",
    },
    {
      label: "Out of stock",
      value: snapshot.outCount,
      href: "/dashboard/employee/inventory",
      icon: CircleAlert,
      tone: snapshot.outCount > 0 ? "text-red-600" : "text-zinc-400",
    },
    {
      label: "Pending orders",
      value: pending.length,
      href: "/dashboard/employee/transactions",
      icon: ReceiptText,
      tone: pending.length > 0 ? "text-amber-600" : "text-zinc-400",
    },
    {
      label: "Overdue follow-ups",
      value: overdueFollowUps,
      href: "/dashboard/operations",
      icon: CalendarClock,
      tone: overdueFollowUps > 0 ? "text-amber-600" : "text-zinc-400",
    },
  ] as const;

  const quickLinks = [
    { label: "Products & pricing", href: "/dashboard/products", icon: PackageSearch },
    { label: "Receive stock", href: "/dashboard/employee/receive-stock", icon: Boxes },
    { label: "Invoices", href: "/dashboard/invoices", icon: ReceiptText },
    { label: "Customers", href: "/dashboard/customers", icon: Users },
    { label: "End-of-day report", href: "/dashboard/report", icon: ClipboardList },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Operations Center
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {business.name || "Your business"} · Manager tools — inventory,
          orders, team and follow-ups.
        </p>
      </header>

      {/* Alerts strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {alerts.map((a) => (
          <Link key={a.label} href={a.href}>
            <Card className="p-4 transition-colors hover:bg-zinc-50">
              <div className="flex items-center gap-2">
                <a.icon aria-hidden className={cn("h-4 w-4", a.tone)} />
                <span className="text-xs font-medium text-zinc-500">{a.label}</span>
              </div>
              <p
                className={cn(
                  "mt-2 text-xl font-semibold tabular-nums tracking-tight",
                  a.value > 0 ? "text-zinc-900" : "text-zinc-400",
                )}
              >
                {a.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending orders value */}
      {pending.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500">
          <Wallet aria-hidden className="h-4 w-4 text-amber-500" />
          {money(pendingValue, business.currency)} outstanding across{" "}
          {pending.length} {pending.length === 1 ? "order" : "orders"}.
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 sm:gap-5">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <FollowUpBoard />
          <div className="flex flex-col gap-4 sm:gap-5">
            <AttendanceCard />
            <TeamActivityCard />
          </div>
        </div>
        <PaymentsCard currency={business.currency} />

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Go to</h2>
          <nav aria-label="Operations shortcuts" className="mt-2 flex flex-wrap gap-2">
            {quickLinks.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm font-medium text-zinc-700 shadow-card transition-colors hover:bg-zinc-50"
              >
                <l.icon aria-hidden className="h-4 w-4 text-zinc-400" />
                {l.label}
              </Link>
            ))}
          </nav>
        </Card>
      </div>
    </div>
  );
}
