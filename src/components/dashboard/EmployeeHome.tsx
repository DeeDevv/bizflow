"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  LogOut,
  MapPin,
  Play,
  Square,
  Wrench,
} from "lucide-react";
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
import { useSetup } from "@/lib/setup-store";
import {
  ATTENDANCE_STATUS_LABEL,
  capturePosition,
  recordAttendanceAttempt,
  todaysAttendanceFor,
  useAttendance,
  type AttendanceRecord,
  type WorkplaceLocation,
} from "@/lib/domain/attendance";
import { openFollowUpsFor, completeFollowUp, useFollowUps } from "@/lib/domain/follow-ups";
import { useBusiness } from "@/lib/business-store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { seedEmployees } from "@/lib/mock-data";

/**
 * Employee Work Desk (Phase 3, rebuilt Phase 8.5).
 *
 * Spec §1/§2/§3:
 *  - MULTI-EMPLOYEE: "Who's working?" lists the business's real employee
 *    roster (owner-set) so each person operates under their own identity —
 *    their id lands on every transaction, payment, activity and attendance
 *    record. No employees yet? The role preview still works.
 *  - WORKPLACE ATTENDANCE VERIFICATION: Start Work requests location ONCE
 *    (never continuously, never at login), measures the distance to the
 *    registered workplace and records Verified / Outside workplace / Unable
 *    to verify. Failures alert the Manager and Owner.
 *  - Assigned/due follow-ups show on the desk where relevant.
 */

/* ---------------- Workplace Attendance Verification card ---------------- */

function AttendanceCard() {
  const session = useEmployeeSession();
  const { setup } = useSetup();
  const records = useAttendance();
  const [busy, setBusy] = useState<null | "start_work" | "end_work">(null);
  const [latest, setLatest] = useState<AttendanceRecord | null>(null);

  const employeeId = session.employeeId ?? `role-${session.activeRole ?? "preview"}`;
  const todays = todaysAttendanceFor(records, employeeId);
  const startRecord = todays.find((r) => r.kind === "start_work") ?? null;
  const endRecord = todays.find((r) => r.kind === "end_work") ?? null;
  const workplace: WorkplaceLocation | null = setup.workplace ?? null;

  async function act(kind: "start_work" | "end_work") {
    setBusy(kind);
    const position = await capturePosition();
    const result = recordAttendanceAttempt({
      actor: {
        userId: employeeId,
        name: session.name || "Staff",
        role: session.operationalRole,
      },
      kind,
      workplace,
      position,
    });
    setLatest(result.record);
    setBusy(null);
  }

  const verified = startRecord?.status === "verified";
  const attempted = startRecord !== null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
            Workplace Attendance Verification
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {workplace
              ? `Your location is checked once when you start or end work — never tracked.`
              : "No workplace registered yet — the owner can set it in Settings. Start Work will record “Unable to verify” until then."}
          </p>
        </div>
        {attempted ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              verified
                ? "bg-emerald-50 text-emerald-700"
                : startRecord.status === "outside_workplace"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {ATTENDANCE_STATUS_LABEL[startRecord.status]}
          </span>
        ) : null}
      </div>

      {/* Latest attempt feedback (spec §3 message format) */}
      {latest ? (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            latest.status === "verified"
              ? "bg-emerald-50 text-emerald-800"
              : latest.status === "outside_workplace"
                ? "bg-red-50 text-red-800"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">
            {session.name || "You"} attempted to{" "}
            {latest.kind === "start_work" ? "start" : "end"} work at{" "}
            {new Date(latest.at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-0.5">
            {latest.status === "verified"
              ? `Distance from workplace: ${
                  latest.distanceMeters !== null ? `${latest.distanceMeters}m` : "—"
                } · Status: Verified`
              : latest.status === "outside_workplace"
                ? `Distance from workplace: ${
                    latest.distanceMeters !== null
                      ? latest.distanceMeters >= 1000
                        ? `${(latest.distanceMeters / 1000).toFixed(1)}km`
                        : `${latest.distanceMeters}m`
                      : "—"
                  } · Status: Verification Failed`
                : `Status: Unable to verify — ${latest.failureReason ?? "location unavailable"}`}
          </p>
        </div>
      ) : null}

      {/* Work session state */}
      {verified && !endRecord ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2.5">
          <div className="min-w-0 text-xs text-emerald-800">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              On duty
            </p>
            <p className="mt-0.5">
              Since{" "}
              {new Date(startRecord!.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              {startRecord!.distanceMeters !== null
                ? ` · ${startRecord!.distanceMeters}m from workplace`
                : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void act("end_work")}
            disabled={busy !== null}
            className="shrink-0 gap-1.5"
          >
            <Square aria-hidden className="h-3.5 w-3.5" />
            {busy === "end_work" ? "Ending…" : "End Work"}
          </Button>
        </div>
      ) : endRecord ? (
        <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
          <p className="font-semibold text-zinc-800">Day complete</p>
          <p className="mt-0.5">
            Ended{" "}
            {new Date(endRecord.at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
            . See you tomorrow.
          </p>
        </div>
      ) : (
        <Button
          className="mt-3 w-full gap-2"
          onClick={() => void act("start_work")}
          disabled={busy !== null}
        >
          <Play aria-hidden className="h-4 w-4" />
          {busy === "start_work" ? "Verifying location…" : "Start Work"}
        </Button>
      )}

      {attempted && !verified && !endRecord ? (
        <button
          type="button"
          onClick={() => void act("start_work")}
          className="mt-2 w-full text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Try verification again
        </button>
      ) : null}
    </Card>
  );
}

/* ---------------- Assigned follow-ups (employee view) ---------------- */

function MyFollowUps() {
  const session = useEmployeeSession();
  const followUps = useFollowUps();
  const mine = openFollowUpsFor(followUps, session.name);

  if (mine.length === 0) return null;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
        <CalendarClock aria-hidden className="h-4 w-4 text-brand-600" />
        My follow-ups ({mine.length})
      </h2>
      <ul className="mt-2 divide-y divide-zinc-100">
        {mine.slice(0, 4).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-900">{f.summary}</p>
              <p className="text-xs text-zinc-500">
                Due {new Date(f.dueAt).toLocaleDateString("en-US")}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => completeFollowUp(f.id)}>
              Done
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Identity picker (spec §2: multiple employees) ---------- */

function IdentityPicker() {
  const { setup } = useSetup();

  // Demo mode (no backend): fall back to the seed roster — same pattern as
  // the seed product catalog — so multi-employee attribution is testable.
  // A real business with no employees yet keeps the role preview.
  const roster =
    (setup.employees ?? []).length > 0
      ? (setup.employees ?? []).map((e) => ({ id: e.id, name: e.name, role: e.role }))
      : !isSupabaseConfigured
        ? seedEmployees.map((e, i) => ({
            id: `seed-emp-${i}`,
            name: e.name,
            role: e.role,
          }))
        : [];

  if (roster.length > 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Who&apos;s working?
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Choose your name — everything you do (sales, payments, attendance)
            is recorded under your identity.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {roster.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() =>
                  setEmployeeSession({
                    activeRole: e.role,
                    name: e.name,
                    employeeId: e.id,
                    operationalRole: e.role === "manager" ? "manager" : "employee",
                  })
                }
                className="group flex h-full w-full items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-surface p-4 text-left shadow-card transition-colors hover:bg-zinc-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    {e.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {roleLabel(e.role)}
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

  // Fallback: role preview when the roster is empty (kept from Phase 3).
  return (
    <div className="mx-auto max-w-2xl">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Who&apos;s working?
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a role to open its workspace. Add employees in Setup to sign
          in by name.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {EMPLOYEE_ROLES.map((r) => (
          <li key={r.value}>
            <button
              type="button"
              onClick={() =>
                setEmployeeSession({
                  activeRole: r.value,
                  name: "",
                  employeeId: `role-${r.value}`,
                  operationalRole: r.value === "manager" ? "manager" : "employee",
                })
              }
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

/* ---------------- Main ---------------- */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function EmployeeHome() {
  const session = useEmployeeSession();
  const { business } = useBusiness();

  // No active identity: the picker decides who is working (spec §2).
  if (!session.activeRole) {
    return <IdentityPicker />;
  }

  const role = session.activeRole;
  const name = session.name.trim();
  const tasks = ROLE_TASKS[role];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {greeting()}
            {name ? `, ${name}.` : "."}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {business.name || "Work Desk"} · Signed in as{" "}
            {roleLabel(role).toLowerCase()}
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

      <div className="flex flex-col gap-4">
        {/* Workplace Attendance Verification (spec §3) */}
        <AttendanceCard />

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

        {/* Assigned/due follow-ups where relevant (spec §1) */}
        <MyFollowUps />
      </div>
    </div>
  );
}


