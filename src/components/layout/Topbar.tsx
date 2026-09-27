"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, ClipboardList, LogOut, Menu, PackageSearch, ReceiptText, Search, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { DeleteAccountDialog } from "@/components/auth/DeleteAccountDialog";
import { useAuth } from "@/lib/auth-store";
import { useBusiness } from "@/lib/business-store";
import { useAttentionItems } from "@/lib/attention";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useActiveNotifications,
  useUnreadNotificationCount,
  type BizMateNotification,
} from "@/lib/domain/notifications";
import { formatActivityTime } from "@/lib/activity-store";
import { initialsFromEmail } from "@/lib/utils";

/**
 * Small breadcrumb + actions bar above the page content.
 *
 * The avatar shows the signed-in user's real initials (from their login
 * email — the same derivation as the sidebar footer) and links to Settings.
 *
 * The bell (Phase 8) is the in-app channel over the REAL notification
 * store: engine-raised conditions (deduped, idempotent), the daily
 * report-ready notice, and the live stock/invoice fallback so the panel is
 * never missing a condition the owner can already act on. The badge counts
 * UNREAD notices; reading one stops it counting until its condition
 * changes. Severity is clear labels — info, warning, critical — never
 * numeric scores.
 */

const SEVERITY_DOT: Record<BizMateNotification["severity"], string> = {
  info: "bg-brand-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

function NotificationIcon({ n }: { n: BizMateNotification }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (n.kind === "report_ready")
    return <ClipboardList aria-hidden className={`${cls} text-brand-500`} />;
  if (n.kind === "outstanding_balance")
    return <ReceiptText aria-hidden className={`${cls} text-amber-500`} />;
  return <PackageSearch aria-hidden className={`${cls} text-brand-500`} />;
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  // The REAL notification records (engine conditions + report-ready).
  const notifications = useActiveNotifications();
  const unread = useUnreadNotificationCount();
  // Live fallback keeps overdue invoices / stock conditions visible even
  // before the engine has processed anything — same data as the attention
  // card, one source, two views.
  const attention = useAttentionItems();
  const hasContent = notifications.length > 0 || attention.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
      >
        <Bell aria-hidden className="h-5 w-5" />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white"
          >
            {unread > 9 ? "9+" : unread}
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
              <div className="flex items-center gap-1">
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead()}
                    className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                  >
                    Mark all read
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!hasContent ? (
              <p className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-zinc-500">
                <BellOff aria-hidden className="h-5 w-5 text-zinc-300" />
                You’re all caught up — nothing needs attention.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-zinc-50 last:border-0">
                    <Link
                      href={n.href}
                      onClick={() => {
                        markNotificationRead(n.id);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 hover:bg-zinc-50 ${
                        n.readAt == null ? "bg-brand-50/40" : ""
                      }`}
                    >
                      <NotificationIcon n={n} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[n.severity]}`}
                          />
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${
                              n.readAt == null
                                ? "font-semibold text-zinc-900"
                                : "font-medium text-zinc-600"
                            }`}
                          >
                            {n.title}
                          </span>
                          {n.readAt == null ? (
                            <span className="shrink-0 rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold text-brand-700">
                              New
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{n.detail}</span>
                        <span className="mt-0.5 block text-[10px] tabular-nums text-zinc-400">
                          {formatActivityTime(n.updatedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {attention
                  .filter(
                    (a) =>
                      !notifications.some(
                        (n) => n.href === a.href && n.title === a.title,
                      ),
                  )
                  .map((a) => (
                    <li key={a.id} className="border-b border-zinc-50 last:border-0">
                      <Link
                        href={a.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-zinc-50"
                      >
                        {a.kind === "invoice" ? (
                          <ReceiptText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        ) : (
                          <PackageSearch aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-zinc-900">
                            {a.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{a.detail}</span>
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
