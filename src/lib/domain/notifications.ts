"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";

/**
 * Notification store (Phase 4 foundation).
 *
 * Business events flow through the automation engine, which evaluates
 * importance:
 *
 *   normal          → activity log only (never notifies)
 *   important       → notification (low stock, out of stock, large balance)
 *   action-required → actionable notification (future approvals)
 *
 * No delivery infrastructure (push/email/WhatsApp) is implemented — this is
 * the data structure and service those channels will consume later.
 */

export type NotificationLevel = "important" | "action_required";

export type NotificationKind =
  | "low_stock"
  | "out_of_stock"
  | "outstanding_balance"
  | "stock_adjustment"
  | "approval_request";

export interface BizMateNotification {
  id: string;
  kind: NotificationKind;
  level: NotificationLevel;
  title: string;
  detail: string;
  /** Where the owner should go to act on this. */
  href: string;
  /** Related record id (product, sale, …) — deduplication/state key. */
  subjectId: string;
  /** ISO timestamp of when the condition was first detected. */
  createdAt: string;
  /** ISO timestamp of the last related update (spam-proofing). */
  updatedAt: string;
  /** Resolved conditions stay until cleared (e.g. stock back to normal). */
  resolvedAt: string | null;
}

const store = createPersistentStore<BizMateNotification[]>("bizmate.notifications.v1", []);

const EMPTY: BizMateNotification[] = [];

function getSnapshot(): BizMateNotification[] {
  return store.get();
}

function getServerSnapshot(): BizMateNotification[] {
  return EMPTY;
}

function newId(): string {
  return `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Raise (or update) a condition notification.
 *
 * Idempotent per (kind, subjectId): an existing unresolved condition is
 * updated in place (updatedAt + detail), not duplicated — so a product that
 * stays low on every sale produces ONE notification, refreshed, not a pile.
 */
export function raiseNotification(
  input: Omit<BizMateNotification, "id" | "createdAt" | "updatedAt" | "resolvedAt">,
): void {
  const now = new Date().toISOString();
  const existing = store
    .get()
    .find((n) => n.kind === input.kind && n.subjectId === input.subjectId && !n.resolvedAt);
  if (existing) {
    store.set(
      store
        .get()
        .map((n) =>
          n.id === existing.id ? { ...n, ...input, updatedAt: now } : n,
        ),
    );
    return;
  }
  const full: BizMateNotification = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...input,
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

/** Active (unresolved) notifications, newest first. */
export function useActiveNotifications(): BizMateNotification[] {
  const all = useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
  return all.filter((n) => !n.resolvedAt);
}

/** Plain read for non-React layers (automation engine). */
export function activeNotifications(): BizMateNotification[] {
  return store.get().filter((n) => !n.resolvedAt);
}
