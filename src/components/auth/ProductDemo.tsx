"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  MessageCircle,
  Package,
  Receipt,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Phase 1A — post-splash product demo (skippable, ~20 seconds end to end).
 *
 * A self-contained overlay that renders ONLY while open. It touches no real
 * data, no backend, and no existing page: the auth form simply mounts it
 * above its card, so the flow is Splash → Demo → existing Sign In / Sign Up.
 * All numbers and products below are static demo content.
 *
 * Shown once per browser (localStorage), never again after Skip/finish.
 */

const DEMO_SEEN_KEY = "bizmate.demo.seen";

/** True when this browser has already seen the demo. */
export function demoAlreadySeen(): boolean {
  try {
    return localStorage.getItem(DEMO_SEEN_KEY) === "1";
  } catch {
    return false; // Storage unavailable: the demo simply plays on every visit.
  }
}

function markDemoSeen() {
  try {
    localStorage.setItem(DEMO_SEEN_KEY, "1");
  } catch {
    // Storage unavailable: nothing to remember.
  }
}

const LAST_STEP = 5; // 0–4 = content screens, 5 = final CTA

const TITLES = [
  "Set up your business once.",
  "Your team handles the daily work.",
  "One sale. Everything updates automatically.",
  "Know what's happening without constantly checking.",
  "See what sold and what you have left.",
] as const;

const SUBTITLES = [
  "Add your products, staff and basic business details. BizMate takes it from there.",
  "Record a sale in just a few taps.",
  "BizMate handles the details behind every transaction.",
  "BizMate keeps you updated on what matters.",
  "Your end-of-day report brings your sales and current stock together.",
] as const;

type IconType = React.ComponentType<{ className?: string }>;

/* ------------------------------------------------------------------ */
/* Screen 1 — Set up once                                              */
/* ------------------------------------------------------------------ */

function ScreenOne() {
  return (
    <Card className="p-4 text-left sm:p-5">
      <div className="animate-demo-item" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Business
          </p>
        </div>
        <p className="mt-1 text-sm font-semibold text-zinc-900">David Electronics</p>
      </div>

      <div className="my-3 h-px bg-zinc-100" />

      <div className="animate-demo-item" style={{ animationDelay: "0.4s" }}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Products
          </p>
        </div>
        <ul className="mt-1.5 space-y-1 text-sm text-zinc-700">
          <li>Hisense 1HP Inverter AC</li>
          <li>LG 1.5HP Inverter AC</li>
          <li>Samsung 55&quot; TV</li>
        </ul>
      </div>

      <div className="my-3 h-px bg-zinc-100" />

      <div className="animate-demo-item" style={{ animationDelay: "0.7s" }}>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Employees
          </p>
        </div>
        <p className="mt-1 text-sm font-semibold text-zinc-900">4 employees</p>
      </div>

      <div
        className="animate-demo-pop mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2"
        style={{ animationDelay: "1.6s" }}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-700">Business ready</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 2 — Employees handle daily sales                             */
/* ------------------------------------------------------------------ */

const SALE_ROWS: Array<[string, string]> = [
  ["Product", "Hisense 1HP Inverter AC"],
  ["Quantity", "1"],
  ["Customer", "Walk-in Customer"],
  ["Payment", "Paid"],
];

function ScreenTwo() {
  const [sold, setSold] = useState(false);

  // The sale completes on its own — the user can also tap the button sooner.
  useEffect(() => {
    const t = setTimeout(() => setSold(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Card className="p-4 text-left sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">New Sale</p>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          Employee
        </span>
      </div>

      <dl className="mt-3 space-y-2">
        {SALE_ROWS.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="text-right font-medium text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>

      {sold ? (
        <div className="animate-demo-pop mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">Sale completed</span>
        </div>
      ) : (
        <Button className="mt-4 w-full" onClick={() => setSold(true)}>
          Complete Sale
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 3 — One sale, everything updates                             */
/* ------------------------------------------------------------------ */

const FLOW: Array<{ icon: IconType; cls: string; label: string; sub?: string }> = [
  { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600", label: "Sale recorded" },
  {
    icon: Package,
    cls: "bg-brand-50 text-brand-600",
    label: "Stock −1",
    sub: "Hisense 1HP Inverter AC",
  },
  { icon: Banknote, cls: "bg-emerald-50 text-emerald-600", label: "Payment recorded" },
  {
    icon: TrendingUp,
    cls: "bg-brand-50 text-brand-600",
    label: "Revenue updated",
    sub: "+₦285,000",
  },
  { icon: Users, cls: "bg-emerald-50 text-emerald-600", label: "Customer history updated" },
  {
    icon: Receipt,
    cls: "bg-brand-50 text-brand-600",
    label: "Receipt generated",
    sub: "RCP-0001",
  },
];

function ScreenThree() {
  return (
    <Card className="p-4 text-left sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        </span>
        <p className="text-sm font-semibold text-zinc-900">Sale Completed</p>
      </div>

      <div className="mt-3 pl-4">
        {FLOW.map((row, i) => (
          <div key={row.label}>
            {i > 0 ? (
              <div
                className="animate-demo-line ml-4 h-3 w-px bg-zinc-200"
                style={{ animationDelay: `${i * 0.3 - 0.15}s` }}
              />
            ) : null}
            <div
              className="animate-demo-item flex items-center gap-3"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  row.cls,
                )}
              >
                <row.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-900">{row.label}</p>
                {row.sub ? <p className="text-xs text-zinc-500">{row.sub}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 4 — Stay informed                                            */
/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function ScreenFour() {
  return (
    <div className="space-y-3 text-left">
      <div className="animate-demo-item" style={{ animationDelay: "0.1s" }}>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
              <BarChart3 className="h-4 w-4 text-brand-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">BizMate Daily Update</p>
              <p className="text-xs text-zinc-500">Today at a glance</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Today&apos;s Sales" value="₦850,000" />
            <Stat label="Transactions" value="27" />
            <Stat label="Low Stock" value="3" />
            <Stat label="Out of Stock" value="1" />
          </div>
        </Card>
      </div>

      <div className="animate-demo-pop" style={{ animationDelay: "1.4s" }}>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <BellRing className="h-4 w-4 text-red-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Stock Alert</p>
            <p className="text-xs text-zinc-500">
              Hisense 1HP Inverter AC — 2 remaining
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 5 — Sales + remaining stock (end-of-day report)              */
/* ------------------------------------------------------------------ */

const REPORT_SALES: Array<[string, string]> = [
  ["Hisense 1HP Inverter AC × 1", "₦285,000"],
  ["Samsung 55\" TV × 2", "₦565,000"],
];

const REPORT_STOCK: Array<[string, string]> = [
  ["Hisense 1HP Inverter", "7"],
  ["Hisense 1.5HP Inverter", "10"],
  ["LG 1HP Inverter", "6"],
  ["LG 1.5HP Inverter", "9"],
  ["Chest Freezer 150L", "8"],
  ["Refrigerator 300L", "5"],
  ["Washing Machine 8kg", "6"],
];

function ScreenFive() {
  return (
    <Card className="p-4 text-left sm:p-5">
      <p className="text-sm font-semibold text-zinc-900">End-of-Day Report</p>
      <p className="text-xs text-zinc-500">Today · David Electronics</p>

      <div className="animate-demo-item mt-3" style={{ animationDelay: "0.15s" }}>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Today&apos;s Sales
        </p>
        <ul className="mt-1">
          {REPORT_SALES.map(([name, amount]) => (
            <li
              key={name}
              className="flex items-center justify-between gap-4 py-1 text-sm text-zinc-700"
            >
              <span>{name}</span>
              <span className="font-medium text-zinc-900">{amount}</span>
            </li>
          ))}
          <li className="py-1 text-xs text-zinc-400">and 25 more sales</li>
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm">
          <span className="font-medium text-zinc-500">Total Sales</span>
          <span className="font-semibold text-zinc-900">₦850,000</span>
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-100 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Current Stock
        </p>
        <ul className="mt-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {REPORT_STOCK.map(([name, qty], i) => (
            <li
              key={name}
              className="animate-demo-item flex items-center justify-between gap-3 py-0.5 text-sm text-zinc-700"
              style={{ animationDelay: `${0.3 + i * 0.08}s` }}
            >
              <span className="truncate">{name}</span>
              <span className="font-medium text-zinc-900">{qty}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button variant="secondary" className="mt-4 w-full gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        Send to WhatsApp
      </Button>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta({ onStart }: { onStart: (dest: "login" | "signup") => void }) {
  return (
    <div className="animate-demo-item text-center">
      <Image
        src="/bizmate-logo.png"
        alt="BizMate"
        width={240}
        height={54}
        priority
        className="animate-logo-pulse mx-auto h-auto w-44"
      />
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        You run the business.
      </h2>
      <p className="text-2xl font-semibold tracking-tight text-brand-600 sm:text-3xl">
        BizMate handles the details.
      </p>
      <p className="mt-3 text-sm text-zinc-500">
        Less manual work. Better visibility. Smarter operations.
      </p>
      <div className="mt-6 space-y-2">
        <Button className="w-full" onClick={() => onStart("signup")}>
          Get Started
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => onStart("login")}>
          Sign In
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

export function ProductDemo({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (dest: "login" | "signup") => void;
}) {
  const [step, setStep] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const final = step >= LAST_STEP;

  const close = useCallback(() => {
    markDemoSeen();
    onClose();
  }, [onClose]);

  // Focus the overlay when it opens, and support keyboard navigation.
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(s + 1, LAST_STEP));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    if (!start) return;
    touchStart.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) setStep((s) => Math.min(s + 1, LAST_STEP));
    else setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="A quick look at BizMate"
      className="fixed inset-0 z-[90] flex flex-col bg-canvas outline-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header: brand + Skip */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
        <Image
          src="/bizmate-logo.png"
          alt="BizMate"
          width={128}
          height={29}
          className="h-auto w-24"
        />
        {!final ? (
          <Button variant="ghost" size="sm" onClick={close}>
            Skip
          </Button>
        ) : null}
      </div>

      {/* Screen content */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-2">
        {/* key={step} remounts the screen so its entrance animation replays */}
        <div key={step} className="animate-demo-item w-full max-w-md">
          {!final ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                {TITLES[step]}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-500">
                {SUBTITLES[step]}
              </p>
            </div>
          ) : null}
          <div className={final ? "" : "mt-5"}>
            {step === 0 ? <ScreenOne /> : null}
            {step === 1 ? <ScreenTwo /> : null}
            {step === 2 ? <ScreenThree /> : null}
            {step === 3 ? <ScreenFour /> : null}
            {step === 4 ? <ScreenFive /> : null}
            {final ? (
              <FinalCta
                onStart={(dest) => {
                  // Finishing the demo counts as seen, just like skipping.
                  markDemoSeen();
                  onStart(dest);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer: Back · progress dots · Next */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pb-6 pt-2 sm:px-0">
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <span className="w-14" />
        )}

        {!final ? (
          <div className="flex items-center gap-1.5" aria-label={`Screen ${step + 1} of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to screen ${i + 1}`}
                aria-current={step === i}
                onClick={() => setStep(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  step === i ? "w-5 bg-brand-600" : "w-2 bg-zinc-300 hover:bg-zinc-400",
                )}
              />
            ))}
          </div>
        ) : (
          <span />
        )}

        {!final ? (
          <Button size="sm" onClick={() => setStep((s) => s + 1)}>
            {step === 4 ? "Finish" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <span className="w-14" />
        )}
      </div>
    </div>
  );
}
