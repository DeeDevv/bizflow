import type { NavItem } from "./types";

/**
 * The sections a small-business owner needs.
 * Shared by the desktop sidebar and the mobile drawer.
 * Phase 8.5 adds the Manager's Operations Center ("Team & Ops").
 */
export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "home" },
  { label: "Team & Ops", href: "/dashboard/operations", icon: "operations" },
  { label: "Products", href: "/dashboard/products", icon: "products" },
  { label: "Customers", href: "/dashboard/customers", icon: "customers" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "invoices" },
  { label: "Sales", href: "/dashboard/sales", icon: "sales" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];
