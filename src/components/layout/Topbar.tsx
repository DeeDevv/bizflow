"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, PackageSearch, ReceiptText, Search, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { DeleteAccountDialog } from "@/components/auth/DeleteAccountDialog";
import { useAuth } from "@/lib/auth-store";
import { useBusiness } from "@/lib/business-store";
import { useProducts } from "@/lib/products-store";
import { useInvoices } from "@/lib/invoices-store";
import { effectiveStatus } from "@/lib/invoice-utils";
import { initialsFromEmail } from "@/lib/utils";

/**
 * Small breadcrumb + actions bar above the page content.
 *
 * The avatar shows the signed-in user's real initials (from their login
 * email — the same derivation as the sidebar footer) and links to Settings.
 * The bell opens a real notifications panel built from live business data:
 * overdue invoices and low/out-of-stock products.
 */

type Notification = {
  id: string;
  kind: "invoice" | "stock";
  title: string;
  detail: string;
  href: string;
};

function useNotifications(): Notification[] {
  const { products } = useProducts();
  const { invoices } = useInvoices();

  return useMemo(() => {
    const notes: Notification[] = [];

    for (const inv of invoices) {
      if (effectiveStatus(inv) === "overdue") {
        notes.push({
          id: "inv-" + inv.id,
          kind: "invoice",
          title: `${inv.number} is overdue`,
          detail: "This invoice is past its due date and still unpaid.",
          href: "/dashboard/invoices/" + inv.id,
        });
      }
    }

    for (const p of products) {
      if (p.stock <= 0) {
        notes.push({
          id: "stock-" + p.id,
          kind: "stock",
          title: `${p.name} is out of stock`,
          detail: "Restock before selling more of this product.",
          href: "/dashboard/products",
        });
      } else if (p.stock <= 5) {
        notes.push({
          id: "stock-" + p.id,
          kind: "stock",
          title: `${p.name} is running low`,
          detail: `Only ${p.stock} left in stock.`,
          href: "/dashboard/products",
        });
      }
    }

    return notes.slice(0, 8);
  }, [products, invoices]);
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          notifications.length > 0
            ? `Notifications (${notifications.length})`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
      >
        <Bell aria-hidden className="h-5 w-5" />
        {notifications.length > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white"
          >
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Click-away layer */}
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900">Notifications</p>
              <button
                type="button"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                You’re all caught up — nothing needs attention.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-zinc-50 last:border-0">
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-zinc-50"
                    >
                      {n.kind === "invoice" ? (
                        <ReceiptText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <PackageSearch aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-900">
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{n.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Topbar({ title }: { title: string }) {
  const [navOpen, setNavOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { business } = useBusiness();

  const initials = user?.email ? initialsFromEmail(user.email) : "··";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-surface/85 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Mobile: hamburger + brand */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-2 rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-900 lg:hidden"
          >
            BizMate
          </Link>

          {/* Desktop: breadcrumb (business name once registered) */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="text-sm text-zinc-500">
              {business.name || "Business"}
            </span>
            <span aria-hidden className="text-zinc-300">/</span>
            <span className="truncate text-sm font-medium text-zinc-900" aria-current="page">
              {title}
            </span>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative hidden sm:block">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="search"
                placeholder="Search…"
                aria-label="Search"
                className="h-9 w-44 rounded-lg border border-zinc-200 bg-canvas pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 md:w-64"
              />
            </div>
            <button
              type="button"
              aria-label="Search"
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 sm:hidden"
            >
              <Search aria-hidden className="h-5 w-5" />
            </button>

            <NotificationsBell />

            {/* Avatar: the real signed-in user; click opens account actions. */}
            <UserMenu
              initials={initials}
              email={user?.email ?? ""}
              businessName={business.name}
              onLogout={() => void signOut()}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>
      </header>

      {/* Rendered outside the (backdrop-blurred) header so the fixed overlay
          isn't confined to the header box. */}
      {deleteOpen ? (
        <DeleteAccountDialog
          email={user?.email ?? ""}
          businessName={business.name}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}

      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </>
  );
}

function UserMenu({
  initials,
  email,
  businessName,
  onLogout,
  onDelete,
}: {
  initials: string;
  email: string;
  businessName: string;
  onLogout: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-200"
      >
        {initials}
      </button>

      {open ? (
        <>
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Account"
            className="absolute right-0 z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-lg"
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-zinc-900">
                {email || "Signed in"}
              </p>
              {businessName ? (
                <p className="mt-0.5 truncate text-xs text-zinc-500">{businessName}</p>
              ) : null}
            </div>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <SettingsIcon aria-hidden className="h-4 w-4 text-zinc-400" />
              Business settings
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <LogOut aria-hidden className="h-4 w-4 text-zinc-400" />
              Log out
            </button>
            <div aria-hidden className="border-t border-zinc-100" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete account
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
