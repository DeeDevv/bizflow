import type { EmployeeRole } from "../employee-roles";

/**
 * Permission foundation (Phase 4/5).
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
  | "canViewCostPrices"
  | "canViewInventory"
  | "canManageProducts";

/** Role → capability matrix. The owner implicitly holds everything. */
const MATRIX: Record<EmployeeRole, Capability[]> = {
  cashier: ["canCompleteSale", "canReceiveStock", "canApplyDiscount", "canViewInventory"],
  sales: ["canCompleteSale", "canReceiveStock", "canApplyDiscount", "canViewInventory"],
  inventory: ["canReceiveStock", "canAdjustStock", "canViewInventory"],
  manager: [
    "canCompleteSale",
    "canReceiveStock",
    "canAdjustStock",
    "canApplyDiscount",
    "canRefund",
    "canViewCostPrices",
    "canViewInventory",
    "canManageProducts",
  ],
  service: ["canCompleteSale", "canViewInventory"],
};

/** Owner-level capabilities no ordinary employee role holds by default. */
const OWNER_ONLY: Capability[] = ["canManageEmployees", "canViewCostPrices"];

export function hasCapability(role: EmployeeRole | null, capability: Capability): boolean {
  if (role === null) return true; // owner / pre-role context
  if (OWNER_ONLY.includes(capability)) return false;
  return MATRIX[role]?.includes(capability) ?? false;
}
