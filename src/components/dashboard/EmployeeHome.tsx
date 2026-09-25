"use client";

import Link from "next/link";
import { ArrowRight, LogOut, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  EMPLOYEE_ROLES,
  ROLE_TASKS,
  roleLabel,
} from "@/lib/employee-roles";
import {
  clearEmployeeSession,
  setEmployeeSession,
  useEmployeeSession,
} from "@/lib/employee-session";

/**
 * Employee Home (Phase 3) — the operation-focused experience employees land
 * on instead of the owner dashboard. A mock role picker stands in for real
 * employee sign-in (backend comes later): pick a role, get exactly that
 * role's tools, nothing owner-level.
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function EmployeeHome() {
  const session = useEmployeeSession();

  // No active role: let the viewer choose which role to experience (mock
  // sign-in until the backend provides real employee accounts).
  if (!session.activeRole) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Who&apos;s working?
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Choose a role to open its workspace. (Real employee sign-in arrives
            with accounts — this is the role preview.)
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {EMPLOYEE_ROLES.map((r) => (
            <li key={r.value}>
              <button
                type="button"
                onClick={() => setEmployeeSession({ activeRole: r.value, name: "" })}
                className="group flex h-full w-full items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-surface p-4 text-left shadow-card transition-colors hover:bg-zinc-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    {r.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {r.description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-brand-600"
                />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-zinc-400">
          Owner view is the default dashboard —{" "}
          <Link href="/dashboard" className="underline hover:text-zinc-600">
            go back
          </Link>
          .
        </p>
      </div>
    );
  }

  const role = session.activeRole;
  const name = session.name.trim();
  const tasks = ROLE_TASKS[role];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {greeting()}{name ? `, ${name}.` : "."}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Signed in as {roleLabel(role).toLowerCase()}. Here&apos;s your workspace.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearEmployeeSession()}
          className="shrink-0 gap-1.5"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Exit
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) =>
          task.href ? (
            <li key={task.label}>
              <Link
                href={task.href}
                className="group flex h-full items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-surface p-4 shadow-card transition-colors hover:bg-zinc-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    {task.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {task.description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-brand-600"
                />
              </Link>
            </li>
          ) : (
            <li key={task.label}>
              <div className="flex h-full items-start justify-between gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
                <span>
                  <span className="block text-sm font-semibold text-zinc-500">
                    {task.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    {task.description} — coming soon
                  </span>
                </span>
                <Wrench aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
              </div>
            </li>
          ),
        )}
      </ul>

      <Card className="mt-6 p-4">
        <p className="text-xs text-zinc-500">
          Tip: ask your manager to rename you in Team settings — your name
          appears on every sale you complete.
        </p>
        <button
          type="button"
          onClick={() => {
            const entered = window.prompt("Your name (shown on receipts and activity)");
            if (entered && entered.trim()) {
              setEmployeeSession({ name: entered.trim() });
            }
          }}
          className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Set my display name
        </button>
      </Card>
    </div>
  );
}
