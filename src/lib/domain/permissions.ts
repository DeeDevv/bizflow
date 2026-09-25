import type { EmployeeRole } from "../employee-roles";

/**
 * Permission foundation (Phase 4, spec §40).
 *
 * UI may consult these checks, but the real enforcement belongs to the
 * future backend. Centralizing them now means the engine's sensitive paths
 * (refunds, adjustments, big discounts) already know where the gate is.
 */

export type Capability =
  | "canCompleteSale"
  | "canReceiveStock"
  | "canAdjustStock"
  | "canApplyDiscount"
  | "canRefund"
  | "canManageEmployees"
  | "canViewCostPrices";

/** Role → capability matrix. The owner implicitly holds everything. */
const MATRIX: Record<EmployeeRole, Capability[]> = {
  cashier: ["canCompleteSale", "canReceiveStock", "canApplyDiscount"],
  sales: ["canCompleteSale", "canReceiveStock", "canApplyDiscount"],
  inventory: ["canReceiveStock", "canAdjustStock"],
  manager: [
    "canCompleteSale",
    "canReceiveStock",
    "canAdjustStock",
    "canApplyDiscount",
    "canRefund",
    "canViewCostPrices",
  ],
  service: ["canCompleteSale"],
};

/** Owner-level capabilities no ordinary employee role holds by default. */
const OWNER_ONLY: Capability[] = ["canManageEmployees", "canViewCostPrices"];

export function hasCapability(role: EmployeeRole | null, capability: Capability): boolean {
  if (role === null) return true; // owner / pre-role context
  if (OWNER_ONLY.includes(capability)) return false;
  return MATRIX[role]?.includes(capability) ?? false;
}
