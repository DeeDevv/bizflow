"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { MobileNav } from "./MobileNav";

/** Small breadcrumb shown on desktop above the page content. */
export function Topbar({ title }: { title: string }) {
  const [navOpen, setNavOpen] = useState(false);

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
            BizFlow
          </Link>

          {/* Desktop: breadcrumb */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="text-sm text-zinc-500">Business</span>
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
            <button
              type="button"
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
            >
              <Bell aria-hidden className="h-5 w-5" />
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
              />
            </button>
            <span
              aria-hidden
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"
            >
              AM
            </span>
          </div>
        </div>
      </header>

      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
    </>
  );
}
