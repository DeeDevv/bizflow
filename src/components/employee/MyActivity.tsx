"use client";

import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useActivity, formatActivityTime } from "@/lib/activity-store";

/**
 * My Activity (Phase 3) — what this employee did, newest first. The UI
 * foundation for the future audit trail; local/mock records for now.
 */
export function MyActivity() {
  const entries = useActivity();

  return (
    <div>
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          My Activity
        </h1>
        <p className="mt-1 text-sm text-zinc-500">What you&apos;ve done today.</p>
      </div>

      {entries.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <ClipboardList aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">Nothing yet today</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Sales, customers, and stock you record will show up here.
          </p>
        </Card>
      ) : (
        <ol className="relative space-y-0 rounded-xl border border-zinc-200 bg-surface shadow-card">
          {entries.map((e, i) => (
            <li
              key={e.id}
              className={`flex gap-3 px-4 py-3 ${i < entries.length - 1 ? "border-b border-zinc-100" : ""}`}
            >
              <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-zinc-400">
                {formatActivityTime(e.at)}
              </span>
              <p className="text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">{e.actor}</span> {e.label}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
