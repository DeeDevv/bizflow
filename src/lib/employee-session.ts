"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore } from "./persistent-store";
import type { EmployeeRole } from "./employee-roles";

/**
 * Mock employee session (Phase 3).
 *
 * Until the new backend provides real employee accounts and sign-in, this
 * store holds which role is currently "operating" the app — set from the
 * Employee Home role picker. It is device-local UI state only: no
 * authentication, no server session, nothing the owner's account depends on.
 */

export interface EmployeeSession {
  /** null = owner/first-run experience; a role = employee preview. */
  activeRole: EmployeeRole | null;
  /** Display name for greetings and receipts. */
  name: string;
}

const seed: EmployeeSession = { activeRole: null, name: "" };

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
