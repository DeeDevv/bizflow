import type { EmployeeRole } from "../employee-roles";

/**
 * Role architecture (Phase 8.5, spec §1 + §16).
 *
 * Exactly three operational roles sit above the employee job roles:
 *
 *   Owner   — COMMAND CENTER — monitors: dashboards, reports, notifications,
 *             staff activity/attendance. Does no routine data entry.
 *   Manager — OPERATIONS CENTER — manages: inventory, product pricing and
 *             discounts, stock, customers, follow-ups, alerts.
 *   Employee — WORK DESK — executes: Start/End Work, customer info, product
 *             search, quantities, payment entry, receipts, follow-ups.
 *
 * `null` (no employee session) means the owner/first-run viewer: the UI is
 * the owner's Command Center, so owner capabilities apply.
 *
 * Enforcement is NOT only hidden buttons (spec §16): every management
 * mutation goes through the automation engine, and the engine checks
 * `requireCapability` before touching anything. A manager-only action
 * attempted as an employee is REJECTED in the domain layer — the UI hiding
 * is just presentation.
 */

/** The three primary operational roles. */
export type OperationalRole = "owner" | "manager" | "employee";

/** What a signed-in identity can be, resolved for permission checks. */
export type Actor = {
  /** Operational role — the one that decides capabilities. */
  operationalRole: OperationalRole;
  /** Stable employee/user id ("owner" for the owner actor). */
  userId: string;
  /** Display name for activity/audit attribution. */
  name: string;
};

/** Capabilities the three roles hold. */
export type Capability =
  // Owner
  | "viewReports"
  | "viewNotifications"
  | "viewTeamActivity"
  | "viewAttendance"
  | "viewCostPrices"
  /** Phase 8.6 (spec §7): owner-only financial visibility — costs, profits,
   * the financial overview. Deliberately NOT manager/employee: cost and
   * profit stay private to the business owner. */
  | "viewProfits"
  // Manager (and above)
  | "manageProducts"
  | "setPricing"
  | "adjustStock"
  | "receiveStock"
  | "viewAlerts"
  | "manageFollowUps"
  | "viewCustomers"
  | "recordPayment"
  // Employee (and above)
  | "completeSale"
  | "verifyAttendanceSelf"
  | "viewOwnActivity";

/** Role → capability matrix. Owner/manager are supersets by construction. */
const MATRIX: Record<OperationalRole, Capability[]> = {
  owner: [
    "viewReports",
    "viewNotifications",
    "viewTeamActivity",
    "viewAttendance",
    "viewCostPrices",
    "viewProfits",
    "viewCustomers",
    "viewAlerts",
  ],
  manager: [
    "viewReports",
    "viewNotifications",
    "viewTeamActivity",
    "viewAttendance",
    "viewCostPrices",
    "viewCustomers",
    "viewAlerts",
    "manageProducts",
    "setPricing",
    "adjustStock",
    "receiveStock",
    "manageFollowUps",
    "recordPayment",
  ],
  employee: [
    "completeSale",
    "verifyAttendanceSelf",
    "viewOwnActivity",
    "viewCustomers",
    "receiveStock",
    "recordPayment",
  ],
};

/** Resolve the actor from an employee session (the React-facing entry). */
export function actorFromSession(session: {
  activeRole: EmployeeRole | null;
  name: string;
  employeeId?: string | null;
}): Actor {
  if (session.activeRole === null) {
    return { operationalRole: "owner", userId: "owner", name: session.name || "Owner" };
  }
  return {
    operationalRole: "employee",
    userId: session.employeeId || `role-${session.activeRole}`,
    name: session.name || "Staff",
  };
}

/** True when the actor holds the capability. Pure — safe in domain code. */
export function hasCapability(actor: Actor | null, capability: Capability): boolean {
  if (!actor) return false;
  return MATRIX[actor.operationalRole]?.includes(capability) ?? false;
}

/**
 * Domain-layer gate (spec §16): throw unless the actor holds the
 * capability. The automation engine calls this BEFORE any mutation, so a
 * bypassed UI still cannot perform manager-only operations.
 */
export function requireCapability(actor: Actor | null, capability: Capability): void {
  if (!hasCapability(actor, capability)) {
    const role = actor?.operationalRole ?? "unknown";
    throw new PermissionError(
      `Your role (${role}) does not allow this action. Ask a manager or the owner.`,
    );
  }
}

/** Thrown by requireCapability — caught by the engine and surfaced as {kind:"error"}. */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/** One-line label for badges and greetings. */
export function roleLabel(opRole: OperationalRole): string {
  switch (opRole) {
    case "owner":
      return "Owner · Command Center";
    case "manager":
      return "Manager · Operations Center";
    default:
      return "Employee · Work Desk";
  }
}

/* ------------------------------------------------------------------ */
/* Legacy capability shim (Phase 4/5)                                  */
/*                                                                     */
/* Existing components (ProductInventoryDetail, EmployeeInventory) call */
/* hasCapability(role, "canAdjustStock" | …) with a raw EmployeeRole.   */
/* These adapters map the old questions onto the three-role matrix so   */
/* no view needs rewriting while staying truthful: manager job-role →   */
/* manager operational role; everything else → employee; null → owner.  */
/* ------------------------------------------------------------------ */

export type LegacyCapability =
  | "canCompleteSale"
  | "canReceiveStock"
  | "canAdjustStock"
  | "canApplyDiscount"
  | "canRefund"
  | "canManageEmployees"
  | "canViewCostPrices"
  | "canViewInventory"
  | "canManageProducts";

export function hasLegacyCapability(
  role: EmployeeRole | null,
  legacy: LegacyCapability,
): boolean {
  const actor: Actor =
    role === null
      ? { operationalRole: "owner", userId: "owner", name: "Owner" }
      : role === "manager"
        ? { operationalRole: "manager", userId: `role-${role}`, name: "Manager" }
        : { operationalRole: "employee", userId: `role-${role}`, name: "Staff" };
  const mapped: Record<Exclude<LegacyCapability, never>, Capability | null> = {
    canCompleteSale: "completeSale",
    canReceiveStock: "receiveStock",
    canAdjustStock: "adjustStock",
    canApplyDiscount: null, // employees never set discounts (spec §4)
    canRefund: "adjustStock",
    canManageEmployees: null, // owner capability, backend phase
    canViewCostPrices: "viewCostPrices",
    canViewInventory: "viewCustomers", // every role may look at stock; reuse a universal cap
    canManageProducts: "manageProducts",
  };
  const capability = mapped[legacy];
  if (capability === null) return false;
  return hasCapability(actor, capability);
}

/* ------------------------------------------------------------------ */
/* Phase 8.6 (spec §7): owner-only financial visibility.               */
/*                                                                     */
/* The financial overview route guards with THIS, not with UI hiding:  */
/* cost/profit figures stay invisible to managers and employees even   */
/* via direct routes or manipulated client state.                      */
/* ------------------------------------------------------------------ */

export function canViewFinancials(session: {
  activeRole: EmployeeRole | null;
}): boolean {
  const role = session.activeRole;
  // null session = owner preview; a manager job role keeps the manager's
  // existing viewCostPrices shim (legacy screens) but never viewProfits.
  return role === null;
}

/**
 * Engine/actor variant of the §7 guard: owner operational role only.
 * Managers hold viewCostPrices (existing screens) but NOT viewProfits.
 */
export function actorCanViewFinancials(actor: Actor | null): boolean {
  return hasCapability(actor, "viewProfits");
}
