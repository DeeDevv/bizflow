"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPersistentStore } from "../persistent-store";
import { raiseNotification } from "./notifications";

/**
 * Workplace Attendance Verification (Phase 8.5, spec §3 + §13).
 *
 * Location is captured ONLY at the explicit Start Work / End Work action —
 * never continuously, never at login. The employee's position is compared
 * with the registered workplace location and classified:
 *
 *   verified           — inside the configured radius
 *   outside_workplace  — position known but beyond the radius (failed)
 *   unable_to_verify   — no position (denied permission, unsupported device,
 *                        timeout). NEVER faked into a verification.
 *
 * Every attempt is recorded (spec: "attendance events are recorded
 * correctly" — including failures). A FAILED attempt raises one attendance
 * notification for Manager + Owner, deduped per employee+day by the
 * notification store. Normal verifications stay in the attendance record
 * only — no notification spam (spec §13).
 */

export type AttendanceKind = "start_work" | "end_work";

export type AttendanceStatus = "verified" | "outside_workplace" | "unable_to_verify";

/** The workplace coordinates + radius (owner captures these in Settings). */
export interface WorkplaceLocation {
  lat: number;
  lng: number;
  /** Verification radius in metres; configurable, default 100. */
  radiusMeters: number;
  capturedAt?: string;
}

/** One Start/End Work attempt with its verification result. */
export interface AttendanceRecord {
  id: string;
  /** Employee attribution (spec §2: individually attributable). */
  employeeId: string;
  employeeName: string;
  /** "owner" for the owner actor. */
  role: "owner" | "manager" | "employee";
  kind: AttendanceKind;
  status: AttendanceStatus;
  /** ISO timestamp of the attempt. */
  at: string;
  /** Captured position, when the device provided one. */
  latitude: number | null;
  longitude: number | null;
  /** GPS accuracy in metres, when provided. */
  accuracy: number | null;
  /** Distance from the workplace in metres, when computable. */
  distanceMeters: number | null;
  /** Configured radius at the time of the attempt. */
  radiusMeters: number | null;
  /** Human-readable reason when verification failed or was impossible. */
  failureReason: string | null;
}

const MAX_RECORDS = 500;

const store = createPersistentStore<AttendanceRecord[]>("bizmate.attendance.v1", []);

const EMPTY: AttendanceRecord[] = [];

function getSnapshot(): AttendanceRecord[] {
  return store.get();
}

function getServerSnapshot(): AttendanceRecord[] {
  return EMPTY;
}

/* ---------------- Geolocation primitives ---------------- */

/** Why a browser position could not be captured. */
export type LocationError =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unknown";

export const LOCATION_ERROR_MESSAGES: Record<LocationError, string> = {
  unsupported: "This device or browser does not support location.",
  permission_denied:
    "Location permission was denied. Allow location access for this site and try again.",
  position_unavailable:
    "Your position could not be determined right now. Check your device's location services.",
  timeout: "Getting your location took too long. Move somewhere with a clearer view of the sky and try again.",
  unknown: "Your location could not be captured. Please try again.",
};

/** Map a browser GeolocationPositionError onto our reason codes. */
function mapGeolocationError(err: { code?: number; message?: string }): LocationError {
  if (typeof err.code === "number") {
    if (err.code === 1) return "permission_denied";
    if (err.code === 2) return "position_unavailable";
    if (err.code === 3) return "timeout";
  }
  if (err.message?.toLowerCase().includes("permission")) return "permission_denied";
  return "unknown";
}

/** One-shot position capture — the ONLY place BizMate touches geolocation. */
export function capturePosition(
  timeoutMs = 10_000,
): Promise<
  { ok: true; latitude: number; longitude: number; accuracy: number | null } | { ok: false; reason: LocationError }
> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
        }),
      (err) => resolve({ ok: false, reason: mapGeolocationError(err) }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/** Great-circle distance between two points, in metres (haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth's mean radius, metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "42 m" / "6.2 km" for messages (spec §3 examples). */
export function formatDistance(meters: number | null): string {
  if (meters === null) return "unknown distance";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** Human label for a status. */
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  verified: "Verified",
  outside_workplace: "Outside workplace — verification failed",
  unable_to_verify: "Unable to verify",
};

/* ---------------- The verification flow ---------------- */

export type AttendanceResult =
  | { kind: "ok"; record: AttendanceRecord; verified: boolean }
  | { kind: "error"; message: string; record: AttendanceRecord };

function newId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function classify(
  position: { ok: true; latitude: number; longitude: number; accuracy: number | null } | { ok: false; reason: LocationError },
  workplace: WorkplaceLocation | null,
): Pick<
  AttendanceRecord,
  "status" | "latitude" | "longitude" | "accuracy" | "distanceMeters" | "radiusMeters" | "failureReason"
> {
  if (!position.ok) {
    return {
      status: "unable_to_verify",
      latitude: null,
      longitude: null,
      accuracy: null,
      distanceMeters: null,
      radiusMeters: workplace?.radiusMeters ?? null,
      failureReason: LOCATION_ERROR_MESSAGES[position.reason],
    };
  }
  if (!workplace) {
    return {
      status: "unable_to_verify",
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      distanceMeters: null,
      radiusMeters: null,
      failureReason:
        "The workplace location is not registered yet. The owner can set it in Settings.",
    };
  }
  const distance = haversineMeters(
    position.latitude,
    position.longitude,
    workplace.lat,
    workplace.lng,
  );
  const verified = distance <= workplace.radiusMeters;
  return {
    status: verified ? "verified" : "outside_workplace",
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    distanceMeters: Math.round(distance),
    radiusMeters: workplace.radiusMeters,
    failureReason: verified ? null : `You are ${formatDistance(distance)} from the workplace.`,
  };
}

/**
 * Record one attendance attempt, persist it, and raise the Manager/Owner
 * alert when verification FAILED (spec §13). Verified attempts stay quiet.
 * The caller supplies the workplace config + attribution; the record is the
 * single source for the attendance views.
 */
export function recordAttendanceAttempt(input: {
  actor: { userId: string; name: string; role: "owner" | "manager" | "employee" };
  kind: AttendanceKind;
  workplace: WorkplaceLocation | null;
  position:
    | { ok: true; latitude: number; longitude: number; accuracy: number | null }
    | { ok: false; reason: LocationError };
}): AttendanceResult {
  const { actor, kind, workplace, position } = input;
  const at = new Date();
  const classification = classify(position, workplace);

  const record: AttendanceRecord = {
    id: newId(),
    employeeId: actor.userId,
    employeeName: actor.name,
    role: actor.role,
    kind,
    at: at.toISOString(),
    ...classification,
  };

  store.set([record, ...store.get()].slice(0, MAX_RECORDS));

  if (record.status === "verified") {
    return { kind: "ok", record, verified: true };
  }

  // Verification failed → the business should know (spec §13 example).
  const time = formatActivityTime(record.at);
  const distance = formatDistance(record.distanceMeters);
  raiseNotification({
    kind: "attendance",
    severity: record.status === "outside_workplace" ? "warning" : "info",
    title:
      record.status === "outside_workplace"
        ? `${actor.name} failed workplace verification`
        : `${actor.name} could not verify attendance`,
    detail:
      record.status === "outside_workplace"
        ? `${actor.name} attempted to ${kind === "start_work" ? "start" : "end"} work at ${time} — ${distance} from workplace. Verification failed.`
        : `${actor.name} attempted to ${kind === "start_work" ? "start" : "end"} work at ${time}. ${record.failureReason ?? "Location unavailable."}`,
    href: "/dashboard/operations?tab=attendance",
    subjectId: `${actor.userId}:${kind}:${record.at.slice(0, 10)}`,
  });

  return {
    kind: "ok",
    record,
    verified: false,
  };
}

/** "8:17 AM" for messages. */
function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------------- Stores / hooks ---------------- */

/** All attendance records, newest first. */
export function useAttendance(): AttendanceRecord[] {
  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

/** Plain read for non-React layers. */
export function attendanceRecords(): AttendanceRecord[] {
  return store.get();
}

/** Today's attendance for one employee (Start + End), newest first. */
export function todaysAttendanceFor(
  records: AttendanceRecord[],
  employeeId: string,
  now: Date = new Date(),
): AttendanceRecord[] {
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  return records.filter((r) => {
    if (r.employeeId !== employeeId) return false;
    const d = new Date(r.at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === key;
  });
}

/** True when this employee has successfully started work today. */
export function hasStartedWorkToday(
  records: AttendanceRecord[],
  employeeId: string,
  now: Date = new Date(),
): boolean {
  return todaysAttendanceFor(records, employeeId, now).some(
    (r) => r.kind === "start_work" && r.status === "verified",
  );
}

/**
 * Live clock for the work-session timer, hydration-safe (null during SSR
 * so nothing time-based renders on the server).
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // First value set in a task (not synchronously in the effect body) so
    // React doesn't cascade-render; the interval keeps it ticking.
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}
