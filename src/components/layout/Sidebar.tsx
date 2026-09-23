"use client";

import { LogOut } from "lucide-react";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/lib/auth-store";

function initialsOf(email: string): string {
  const name = email.split("@")[0] || "?";
  const parts = name.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Fixed desktop sidebar (hidden below lg). */
export function Sidebar() {
  const { user, signOut } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-zinc-200 bg-surface lg:flex">
      <div className="flex h-16 items-center border-b border-zinc-100 px-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavLinks items={navItems} />
      </div>

      {/* User footer */}
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          >
            {user ? initialsOf(user.email ?? "") : "··"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-900">
              {user?.email ? user.email.split("@")[0] : "Signed in"}
            </p>
            <p className="truncate text-xs text-zinc-500">{user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Log out"
            title="Log out"
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <LogOut aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
