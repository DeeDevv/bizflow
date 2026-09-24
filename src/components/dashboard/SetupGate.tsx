"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useBusiness } from "@/lib/business-store";
import { saveBusiness } from "@/lib/business-db";
import { CURRENCIES } from "@/lib/currencies";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * First-login gate (fixes "signed up but landed on the dashboard without
 * registering"): when the signed-in owner has no business yet, the dashboard
 * is covered by a focused Business Setup screen. Nothing in the app is
 * usable until the business is registered — which is also where the owner
 * picks their real currency, so no default $ anywhere.
 *
 * Creating the business goes through the same saveBusiness used by Settings
 * (owner_user_id stamped from the session by the database/RLS).
 */

const field =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function SetupGate({ children }: { children: React.ReactNode }) {
  const { business, status, updateBusiness } = useBusiness();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NGN"); // default choice, saved explicitly
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    // One quiet beat while the business record is read — no flash of setup.
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading your workspace…</p>
      </div>
    );
  }

  // Business exists (or demo mode): normal dashboard.
  if (business.id || !isSupabaseConfigured) return <>{children}</>;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your business name.");
      return;
    }
    if (!currency) {
      setError("Please choose your business currency.");
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      name: trimmedName,
      email: "",
      phone: phone.trim(),
      whatsapp: phone.trim(),
      address: "",
      currency,
      logoUrl: "",
      discountsEnabled: true,
      websiteUrl: "",
    };
    const result = await saveBusiness(input);
    if (result.kind === "ok") {
      updateBusiness({ ...input, id: result.id });
      return; // gate unmounts — the dashboard renders
    }
    setBusy(false);
    setError(
      result.kind === "error"
        ? "Could not save: " + result.message
        : "Could not reach the database. Please try again.",
    );
  }

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-6 flex justify-center">
        <Image
          src="/bizmate-logo.png"
          alt="BizMate"
          width={240}
          height={54}
          priority
          className="h-auto w-40"
        />
      </div>

      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Set up your business
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Welcome! Tell us about your business to finish setting up BizMate.
          You can change these details anytime in Settings.
        </p>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleCreate} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="setup-name" className="text-sm font-medium text-zinc-700">
              Business name
            </label>
            <input
              id="setup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dao Electronics Ltd"
              autoFocus
              className={field}
            />
          </div>

          <div>
            <label htmlFor="setup-currency" className="text-sm font-medium text-zinc-700">
              Currency
            </label>
            <select
              id="setup-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={field}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-400">
              Used for every price on your products, invoices, and receipts.
            </p>
          </div>

          <div>
            <label htmlFor="setup-phone" className="text-sm font-medium text-zinc-700">
              Business phone <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="setup-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 801 234 5678"
              className={field}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating your business…" : "Create my business"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
