"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/employee-roles";
import { useEmployeeSession } from "@/lib/employee-session";

/**
 * Employee workspace shell (Phase 3) — a slim top bar with role context and
 * the quick links relevant while operating. Owner chrome (settings, full
 * sidebar) stays out of the employee surface.
 */

const LINKS = [
  { href: "/dashboard/employee", label: "Home" },
  { href: "/dashboard/employee/sale", label: "New Sale" },
  { href: "/dashboard/employee/transactions", label: "Transactions" },
  { href: "/dashboard/employee/inventory", label: "Inventory" },
  { href: "/dashboard/employee/activity", label: "My Activity" },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const session = useEmployeeSession();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 pb-3">
        <Link
          href="/dashboard/employee"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4 text-zinc-400" />
          Employee
        </Link>
        {session.activeRole ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {roleLabel(session.activeRole)}
          </span>
        ) : null}
        <nav aria-label="Employee pages" className="ml-auto flex flex-wrap gap-1">
          {LINKS.map((l) => {
            const active =
              l.href === "/dashboard/employee"
                ? pathname === "/dashboard/employee"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
