"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Customer follow-up automation (Phase 8.5, spec §10).
 *
 * Follow-ups are CREATED BY RULES, not typed in by employees. The automation
 * engine calls `scheduleFollowUpsForSale` when a sale completes and
 * `scheduleFollowUpForPendingOrder` when a part/unpaid order lingers —
 * timing lives in FOLLOW_UP_RULES (business-configurable later):
 *
 *   after purchase   → 3 days   ("how is the AC performing?")
 *   satisfaction     → 30 days  ("happy with it? any referrals?")
 *
 * Rules are evaluated idempotently: one follow-up per (rule, sale, customer)
 * — reprocessing a sale never duplicates. `null` timing means "soon"; the
 * pending-order follow-up has no fixed day offset (it is due immediately).
 */

export type FollowUpStatus = "upcoming" | "due" | "overdue" | "completed";

export type FollowUpSource = "purchase" | "satisfaction" | "pending_order" | "manual";

export interface FollowUpTask {
  id: string;
  /** Rule id (or "manual"). */
  ruleId: FollowUpSource;
  /** Stable subject key — dedupe per rule+sale so replays never duplicate. */
  subjectKey: string;
  customerId: string | null;
  customerName: string;
  /** Human summary, e.g. "Hisense 1.5HP Inverter AC". */
  summary: string;
  /** Sale this came from, when applicable. */
  saleRef: string | null;
  /** When the follow-up becomes due (ISO). */
  dueAt: string;
  /** Assigned employee name (the seller follows up first). */
  assignedTo: string | null;
  createdAt: string;
  /** ISO when marked done; null while open. */
  completedAt: string | null;
  note: string | null;
}

const MAX_TASKS = 300;

const store = createPersistentStore<FollowUpTask[]>("bizmate.followups.v1", []);

const EMPTY: FollowUpTask[] = [];

function getSnapshot(): FollowUpTask[] {
  return store.get();
}

function getServerSnapshot(): FollowUpTask[] {
  return EMPTY;
}

/** The follow-up schedule (owner words — timing configurable later). */
export const FOLLOW_UP_RULES: {
  id: FollowUpSource;
  name: string;
  trigger: string;
  daysAfter: number | null;
}[] = [
  {
    id: "purchase",
    name: "After purchase",
    trigger: "A customer completes a purchase",
    daysAfter: 3,
  },
  {
    id: "satisfaction",
    name: "Customer satisfaction",
    trigger: "A purchase was made",
    daysAfter: 30,
  },
  {
    id: "pending_order",
    name: "Pending order",
    trigger: "An order is left unpaid or partly paid",
    daysAfter: null,
  },
];

/** Create id: rule + subject hash keeps replays from minting new rows. */
function newId(): string {
  return `fup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function dueDate(daysAfter: number | null, from: Date): Date {
  const d = new Date(from);
  if (daysAfter !== null) d.setDate(d.getDate() + daysAfter);
  return d;
}

/**
 * Schedule the configured follow-ups for one completed sale. Idempotent per
 * (rule, subjectKey) — the engine may re-run on replayed events safely.
 */
export function scheduleFollowUpsForSale(input: {
  saleRef: string;
  customerId: string | null;
  customerName: string;
  productSummary: string;
  sellerName: string | null;
  at: string;
}): void {
  if (!input.customerId) return; // walk-ins get no scheduled follow-ups
  const at = new Date(input.at);
  const rulesForSale: Array<{ rule: FollowUpSource; days: number | null }> = [
    { rule: "purchase", days: FOLLOW_UP_RULES.find((r) => r.id === "purchase")?.daysAfter ?? 3 },
    {
      rule: "satisfaction",
      days:
        FOLLOW_UP_RULES.find((r) => r.id === "satisfaction")?.daysAfter ?? 30,
    },
  ];

  for (const { rule, days } of rulesForSale) {
    const subjectKey = `${rule}:${input.saleRef}`;
    const exists = store
      .get()
      .some((t) => t.subjectKey === subjectKey);
    if (exists) continue;

    const task: FollowUpTask = {
      id: newId(),
      ruleId: rule,
      subjectKey,
      customerId: input.customerId,
      customerName: input.customerName,
      summary:
        rule === "purchase"
          ? `Check in on ${input.customerName} — ${input.productSummary}`
          : `Satisfaction check — ${input.customerName} (${input.productSummary})`,
      saleRef: input.saleRef,
      dueAt: dueDate(days, at).toISOString(),
      assignedTo: input.sellerName,
      createdAt: at.toISOString(),
      completedAt: null,
      note: null,
    };
    store.set([task, ...store.get()].slice(0, MAX_TASKS));
  }
}

/**
 * One follow-up for an unresolved (part/unpaid) order. Due immediately —
 * the order is already waiting on the customer.
 */
export function scheduleFollowUpForPendingOrder(input: {
  saleRef: string;
  customerId: string | null;
  customerName: string;
  productSummary: string;
  sellerName: string | null;
  at: string;
}): void {
  const subjectKey = `pending_order:${input.saleRef}`;
  if (store.get().some((t) => t.subjectKey === subjectKey)) return;
  const task: FollowUpTask = {
    id: newId(),
    ruleId: "pending_order",
    subjectKey,
    customerId: input.customerId,
    customerName: input.customerName,
    summary: `Collect balance — ${input.customerName} (${input.productSummary})`,
    saleRef: input.saleRef,
    dueAt: new Date(input.at).toISOString(),
    assignedTo: input.sellerName,
    createdAt: input.at,
    completedAt: null,
    note: null,
  };
  store.set([task, ...store.get()].slice(0, MAX_TASKS));
}

/** When a balance is finally settled, the collection follow-up is done. */
export function completePendingOrderFollowUp(saleRef: string): void {
  const now = new Date().toISOString();
  store.set(
    store.get().map((t) =>
      t.subjectKey === `pending_order:${saleRef}` && !t.completedAt
        ? { ...t, completedAt: now }
        : t,
    ),
  );
}

/** Mark one follow-up completed (Owner/Manager or the assigned employee). */
export function completeFollowUp(id: string): void {
  const now = new Date().toISOString();
  store.set(
    store.get().map((t) => (t.id === id && !t.completedAt ? { ...t, completedAt: now } : t)),
  );
}

/** Live status of a follow-up (completed first, then clock-derived). */
export function followUpStatus(t: FollowUpTask, now: Date = new Date()): FollowUpStatus {
  if (t.completedAt) return "completed";
  const due = new Date(t.dueAt).getTime();
  if (now.getTime() >= due) return "overdue";
  // Due today counts as due (follow-up day).
  const dueDay = new Date(t.dueAt);
  const today = new Date(now);
  if (
    dueDay.getFullYear() === today.getFullYear() &&
    dueDay.getMonth() === today.getMonth() &&
    dueDay.getDate() === today.getDate()
  )
    return "due";
  return "upcoming";
}

/** Grouped view model for the Owner/Manager follow-up board (spec §10). */
export interface FollowUpGroups {
  due: FollowUpTask[];
  upcoming: FollowUpTask[];
  overdue: FollowUpTask[];
  completed: FollowUpTask[];
}

export function groupFollowUps(
  tasks: FollowUpTask[],
  now: Date = new Date(),
): FollowUpGroups {
  const groups: FollowUpGroups = { due: [], upcoming: [], overdue: [], completed: [] };
  for (const t of tasks) {
    const s = followUpStatus(t, now);
    if (s === "completed") groups.completed.push(t);
    else if (s === "overdue") groups.overdue.push(t);
    else if (s === "due") groups.due.push(t);
    else groups.upcoming.push(t);
  }
  const byDue = (a: FollowUpTask, b: FollowUpTask) => a.dueAt.localeCompare(b.dueAt);
  groups.overdue.sort(byDue);
  groups.due.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.completed.sort((a, b) =>
    (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
  );
  return groups;
}

/** React hook — all follow-ups, newest created first. */
export function useFollowUps(): FollowUpTask[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** Plain read for non-React layers. */
export function followUpTasks(): FollowUpTask[] {
  return store.get();
}

/** Open follow-ups assigned to one employee (their Work Desk "to-do"). */
export function openFollowUpsFor(
  tasks: FollowUpTask[],
  employeeName: string,
  now: Date = new Date(),
): FollowUpTask[] {
  return tasks
    .filter(
      (t) =>
        !t.completedAt &&
        t.assignedTo === employeeName &&
        followUpStatus(t, now) !== "upcoming",
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** React hook: due/overdue counts for cards and nav badges. */
export function useOpenFollowUpCounts(): {
  due: number;
  overdue: number;
  total: number;
} {
  const tasks = useFollowUps();
  return useMemo(() => {
    const now = new Date();
    let due = 0;
    let overdue = 0;
    for (const t of tasks) {
      const s = followUpStatus(t, now);
      if (s === "due") due += 1;
      else if (s === "overdue") overdue += 1;
    }
    return { due, overdue, total: tasks.length };
  }, [tasks]);
}
