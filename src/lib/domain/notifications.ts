"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Notification store (Phase 4 foundation, extended in Phase 8).
 *
 * Business events flow through the automation engine, which evaluates
 * importance:
 *
 *   normal          → activity log only (never notifies)
 *   warning/critical→ notification (low stock, out of stock, outstanding balance)
 *   info            → non-urgent notices (the daily report being ready)
 *
 * Phase 8 adds, without changing the anti-spam model:
 *   - `severity`  — info | warning | critical (clear priority, no scores)
 *   - `readAt`    — when the owner read it in the app (null = unread)
 *   - `report_ready` — the once-per-day "your report is ready" notice
 *   - `channels`  — delivery surfaces. Only "in_app" exists today; WhatsApp,
 *     email and push are structure for a later phase. Nothing is "sent".
 *
 * No delivery infrastructure is implemented — this is the data structure and
 * service those future channels will consume.
 */

export type NotificationLevel = "important" | "action_required";

export type NotificationKind =
  | "low_stock"
  | "out_of_stock"
  | "outstanding_balance"
  | "stock_adjustment"
  | "approval_request"
  | "report_ready"
  // Phase 8.5 kinds (spec §12 + §13):
  | "attendance"
  | "new_inventory"
  | "payment_partial"
  | "followup";

/** Clear priority labels — never numeric scores. */
export type NotificationSeverity = "info" | "warning" | "critical";

/**
 * Delivery surfaces. `in_app` is the only live channel; the rest exist so a
 * future delivery layer can filter without a data migration.
 */
export type NotificationChannel = "in_app" | "whatsapp" | "email" | "push";

export interface BizMateNotification {
  id: string;
  kind: NotificationKind;
  /** Legacy Phase 4 importance tag — superseded by `severity` (Phase 8). */
  level?: NotificationLevel;
  /** Report ready = info, low stock = warning, out of stock = critical. */
  severity: NotificationSeverity;
  title: string;
  detail: string;
  /** Where the owner should go to act on this. */
  href: string;
  /** Related record id (product, sale, report day) — deduplication/state key. */
  subjectId: string;
  /** ISO timestamp of when the condition was first detected. */
  createdAt: string;
  /** ISO timestamp of the last related update (spam-proofing). */
  updatedAt: string;
  /** Resolved conditions stay in the record until cleared (e.g. restocked). */
  resolvedAt: string | null;
  /** ISO timestamp the owner read it in the app; null = unread. */
  readAt: string | null;
  /** Surfaces this notice is (or will be) delivered on. */
  channels: NotificationChannel[];
}

const store = createPersistentStore<BizMateNotification[]>("bizmate.notifications.v1", []);

const EMPTY: BizMateNotification[] = [];

/** Default severity per kind — also the migration path for Phase 4 records. */
const DEFAULT_SEVERITY: Record<NotificationKind, NotificationSeverity> = {
  out_of_stock: "critical",
  low_stock: "warning",
  outstanding_balance: "warning",
  stock_adjustment: "info",
  approval_request: "warning",
  report_ready: "info",
  attendance: "warning",
  new_inventory: "info",
  payment_partial: "info",
  followup: "info",
};

/** Fill fields added in Phase 8 for records persisted before it. */
function normalize(n: BizMateNotification): BizMateNotification {
  if (n.severity != null && n.readAt != null && n.channels != null) return n;
  return {
    ...n,
    severity: n.severity ?? DEFAULT_SEVERITY[n.kind] ?? "info",
    readAt: n.readAt ?? null,
    channels: n.channels ?? ["in_app"],
  };
}

// Normalization runs once per store version (set() always swaps the array),
// so useSyncExternalStore always gets a referentially stable snapshot.
let rawRef: BizMateNotification[] | null = null;
let normalizedRef: BizMateNotification[] = EMPTY;

function normalizedAll(): BizMateNotification[] {
  const raw = store.get();
  if (raw !== rawRef) {
    rawRef = raw;
    normalizedRef = raw.map(normalize);
  }
  return normalizedRef;
}

function getSnapshot(): BizMateNotification[] {
  return normalizedAll();
}

function getServerSnapshot(): BizMateNotification[] {
  return EMPTY;
}

function newId(): string {
  return `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** What a caller may raise — severity/channels default from the kind. */
export type NotificationInput = Pick<
  BizMateNotification,
  "kind" | "title" | "detail" | "href" | "subjectId"
> & {
  level?: NotificationLevel;
  severity?: NotificationSeverity;
  channels?: NotificationChannel[];
};

/**
 * Raise (or update) a condition notification.
 *
 * Idempotent per (kind, subjectId): an existing unresolved condition is
 * updated in place (updatedAt + detail), not duplicated — so a product that
 * stays low on every sale produces ONE notification, refreshed, not a pile.
 * Updating a condition never un-reads it.
 */
export function raiseNotification(input: NotificationInput): void {
  const now = new Date().toISOString();
  const existing = store
    .get()
    .find((n) => n.kind === input.kind && n.subjectId === input.subjectId && !n.resolvedAt);
  if (existing) {
    // Explicit patch — only fields actually provided are updated.
    const patch: Partial<BizMateNotification> = {
      title: input.title,
      detail: input.detail,
      href: input.href,
      updatedAt: now,
    };
    if (input.severity) patch.severity = input.severity;
    if (input.level) patch.level = input.level;
    if (input.channels) patch.channels = input.channels;
    store.set(store.get().map((n) => (n.id === existing.id ? { ...n, ...patch } : n)));
    return;
  }
  const full: BizMateNotification = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    readAt: null,
    severity: input.severity ?? DEFAULT_SEVERITY[input.kind],
    channels: input.channels ?? ["in_app"],
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    href: input.href,
    subjectId: input.subjectId,
    ...(input.level ? { level: input.level } : {}),
  };
  store.set([full, ...store.get()]);
}

/** Resolve a condition (e.g. stock received → back to normal). */
export function resolveNotification(
  kind: BizMateNotification["kind"],
  subjectId: string,
): void {
  const now = new Date().toISOString();
  store.set(
    store.get().map((n) =>
      n.kind === kind && n.subjectId === subjectId && !n.resolvedAt
        ? { ...n, resolvedAt: now }
        : n,
    ),
  );
}

/** Mark one notification read (the owner has seen it in the app). */
export function markNotificationRead(id: string): void {
  const list = store.get();
  if (list.every((n) => n.id !== id || n.readAt != null)) return;
  const now = new Date().toISOString();
  store.set(list.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
}

/** Mark everything read (the "Mark all read" action). */
export function markAllNotificationsRead(): void {
  const list = store.get();
  if (list.every((n) => n.readAt != null)) return;
  const now = new Date().toISOString();
  store.set(list.map((n) => (n.readAt == null ? { ...n, readAt: now } : n)));
}

/** Active (unresolved) notifications, newest first. */
export function useActiveNotifications(): BizMateNotification[] {
  const all = useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
  return all.filter((n) => !n.resolvedAt);
}

/** Active + unread — the bell badge number (read notices stop counting). */
export function useUnreadNotificationCount(): number {
  return useActiveNotifications().reduce(
    (sum, n) => (n.readAt == null ? sum + 1 : sum),
    0,
  );
}

/** Plain read for non-React layers (automation engine). */
export function activeNotifications(): BizMateNotification[] {
  return normalizedAll().filter((n) => !n.resolvedAt);
}
