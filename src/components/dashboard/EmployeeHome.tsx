"use client";

import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { ROLE_TASKS, roleLabel, type EmployeeRole } from "@/lib/employee-roles";

/**
 * Employee Home (Phase 2 foundation) — the separate, operation-focused
 * experience employees will land on instead of the owner dashboard. Rendered
 * when an employee role is active; only that role's tools appear.
 *
 * Role-based sessions themselves arrive with the new backend — this screen
 * is the structural foundation: one role in, focused tasks out.
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function EmployeeHome({
  name,
  role,
}: {
  name: string;
  role: EmployeeRole;
}) {
  const tasks = ROLE_TASKS[role];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {greeting()}, {name}.
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          You&apos;re signed in as {roleLabel(role).toLowerCase()}. Here&apos;s your
          workspace.
        </p>
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
    </div>
  );
}
