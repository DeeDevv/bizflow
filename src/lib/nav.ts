import type { NavItem } from "./types";

/**
 * The sections a small-business owner needs.
 * Shared by the desktop sidebar and the mobile drawer.
 * Phase 8.5 adds the Manager's Operations Center ("Team & Ops");
 * Phase 8.6 adds owner-only "Financials" (spec §7) — the Sidebar and
 * MobileNav render it only when the session may view profits.
 */
export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "home" },
  { label: "Team & Ops", href: "/dashboard/operations", icon: "operations" },
  { label: "Financials", href: "/dashboard/finance", icon: "finance", ownerOnly: true },
  { label: "Products", href: "/dashboard/products", icon: "products" },
  { label: "Customers", href: "/dashboard/customers", icon: "customers" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "invoices" },
  { label: "Sales", href: "/dashboard/sales", icon: "sales" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];
