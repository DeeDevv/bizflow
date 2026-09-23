import type { NavItem } from "./types";

/**
 * The sections a small-business owner needs.
 * Shared by the desktop sidebar and the mobile drawer.
 */
export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "home" },
  { label: "Products", href: "/dashboard/products", icon: "products" },
  { label: "Customers", href: "/dashboard/customers", icon: "customers" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "invoices" },
  { label: "Sales", href: "/dashboard/sales", icon: "sales" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];
