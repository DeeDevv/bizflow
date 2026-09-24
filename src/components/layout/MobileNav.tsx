"use client";

import { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";
import { navItems } from "@/lib/nav";
import { useAuth } from "@/lib/auth-store";
import { initialsFromEmail } from "@/lib/utils";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

/** Signed-in user + logout, mirroring the desktop sidebar footer. */
function MobileUserFooter() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const name = email ? email.split("@")[0] : "Signed in";
  const initials = email ? initialsFromEmail(email) : "··";

  return (
    <div className="border-t border-zinc-100 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{name}</p>
          <p className="truncate text-xs text-zinc-500">{email}</p>
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
  );
}

/** Slide-in navigation drawer for small screens. */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastActiveRef.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-100 px-4">
          <Brand />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks items={navItems} />
        </div>

        <MobileUserFooter />
      </div>
    </div>
  );
}
