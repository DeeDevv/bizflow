"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Package,
  ReceiptText,
  Users,
  Settings,
  UsersRound,
} from "lucide-react";
import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const icons = {
  home: Home,
  operations: UsersRound,
  products: Package,
  customers: Users,
  invoices: ReceiptText,
  sales: BarChart3,
  settings: Settings,
} as const;

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active ? "text-brand-600" : "text-zinc-400 group-hover:text-zinc-600",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
