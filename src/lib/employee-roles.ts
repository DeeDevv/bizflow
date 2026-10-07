/**
 * Employee roles (Phase 2 foundation).
 *
 * Permissions are controlled by role, not by long per-person lists — the UI
 * only ever asks "what does this person do?". The task lists below describe
 * what each role sees on their Employee Home; tasks whose destinations don't
 * exist yet are marked ready:false so the UI can render them as "coming soon"
 * until the later phases build them.
 */

export const EMPLOYEE_ROLES = [
  {
    value: "cashier",
    label: "Cashier",
    description: "Records sales and takes payments",
  },
  {
    value: "sales",
    label: "Sales Staff",
    description: "Helps customers and records sales",
  },
  {
    value: "inventory",
    label: "Inventory Staff",
    description: "Receives stock and keeps counts accurate",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Oversees daily operations",
  },
  {
    value: "service",
    label: "Service Staff",
    description: "Handles repairs and service jobs",
  },
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]["value"];

export function roleLabel(role: string): string {
  return EMPLOYEE_ROLES.find((r) => r.value === role)?.label ?? "Team member";
}

/** One shortcut on an employee's home screen. */
export interface RoleTask {
  label: string;
  description: string;
  /** Destination route; undefined = not built yet (renders as coming soon). */
  href?: string;
}

/** The Employee Home shortcuts per role — the role-based UI foundation. */
export const ROLE_TASKS: Record<EmployeeRole, RoleTask[]> = {
  cashier: [
    { label: "New Sale", description: "Record a sale and take payment", href: "/dashboard/employee/sale" },
    { label: "Transactions", description: "Sales you've completed", href: "/dashboard/employee/transactions" },
    { label: "Customers", description: "Look up customer details", href: "/dashboard/customers" },
    { label: "My Activity", description: "Everything you did today", href: "/dashboard/employee/activity" },
  ],
  sales: [
    { label: "New Sale", description: "Record a sale and take payment", href: "/dashboard/employee/sale" },
    { label: "Transactions", description: "Sales you've completed", href: "/dashboard/employee/transactions" },
    { label: "Customers", description: "Look up customer details", href: "/dashboard/customers" },
    { label: "My Activity", description: "Everything you did today", href: "/dashboard/employee/activity" },
  ],
  inventory: [
    { label: "Receive Stock", description: "Record products that just arrived", href: "/dashboard/employee/receive-stock" },
    { label: "Inventory", description: "Check quantities and stock levels", href: "/dashboard/employee/inventory" },
    { label: "Stock Issues", description: "Report damaged or missing items" },
    { label: "My Activity", description: "Everything you did today", href: "/dashboard/employee/activity" },
  ],
  manager: [
    { label: "Operations Center", description: "Orders, stock, team and follow-ups", href: "/dashboard/operations" },
    { label: "Sales", description: "How the business is selling", href: "/dashboard/sales" },
    { label: "Inventory", description: "Quantities and stock levels", href: "/dashboard/employee/inventory" },
    { label: "Add / Edit Products", description: "Catalog, prices and discounts", href: "/dashboard/products" },
    { label: "Customers", description: "Look up customer details", href: "/dashboard/customers" },
    { label: "Reports", description: "End-of-day business report", href: "/dashboard/report" },
  ],
  service: [
    { label: "Today's Jobs", description: "Repairs and service visits for today" },
    { label: "Customers", description: "Look up customer details", href: "/dashboard/customers" },
    { label: "My Tasks", description: "What's assigned to you" },
    { label: "My Activity", description: "Everything you did today", href: "/dashboard/employee/activity" },
  ],
};
