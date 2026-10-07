"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";
import type { EmployeeRole } from "./employee-roles";

/**
 * Employee session (Phase 3 mock, extended Phase 8.5).
 *
 * Until the new backend provides real employee accounts and sign-in, this
 * store holds WHO is currently "operating" the app — picked on the Employee
 * Home screen. Phase 8.5 (spec §2) adds a stable employee id + operational
 * role so every action is individually attributable: transactions, activity,
 * attendance and payments all carry this identity. It is device-local UI
 * state only: no authentication, no server session, nothing the owner's
 * account depends on. Real accounts replace the picker in a later phase.
 */

import type { OperationalRole } from "./domain/permissions";

export interface EmployeeSession {
  /** null = owner/first-run experience; a role = employee preview. */
  activeRole: EmployeeRole | null;
  /** Display name for greetings and receipts. */
  name: string;
  /** Stable identity for attribution ("owner" when no employee session). */
  employeeId: string | null;
  /** The three-role operational role this session operates as. */
  operationalRole: OperationalRole;
}

const seed: EmployeeSession = {
  activeRole: null,
  name: "",
  employeeId: null,
  operationalRole: "owner",
};

const store = createPersistentStore<EmployeeSession>("bizmate.employee-session.v1", seed);

function getSnapshot(): EmployeeSession {
  return store.get();
}

function getServerSnapshot(): EmployeeSession {
  return seed;
}

export function setEmployeeSession(next: Partial<EmployeeSession>): void {
  store.set({ ...store.get(), ...next });
}

export function clearEmployeeSession(): void {
  store.set(seed);
}

export function useEmployeeSession(): EmployeeSession {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** One-shot read of the display name (for activity labels/receipts). */
export function currentEmployeeName(): string {
  try {
    const raw = localStorage.getItem("bizmate.employee-session.v1");
    const parsed = raw
      ? (JSON.parse(raw) as { state?: { name?: string }; name?: string })
      : null;
    return parsed?.state?.name || parsed?.name || "Staff";
  } catch {
    return "Staff";
  }
}

/** One-shot read of the stable actor id (engine attribution). */
export function currentEmployeeId(): string {
  try {
    const raw = localStorage.getItem("bizmate.employee-session.v1");
    const parsed = raw
      ? (
          JSON.parse(raw) as {
            state?: { employeeId?: string | null; activeRole?: string | null };
            employeeId?: string | null;
            activeRole?: string | null;
          }
        )
      : null;
    const state = parsed?.state ?? parsed;
    return state?.employeeId || state?.activeRole || "owner";
  } catch {
    return "owner";
  }
}
