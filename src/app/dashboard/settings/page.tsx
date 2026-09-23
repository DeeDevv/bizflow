"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useBusiness } from "@/lib/business-store";
import { loadBusiness, saveBusiness } from "@/lib/business-db";
import { cn } from "@/lib/utils";

// The database stores the ISO code; the symbol is display-only.
const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "NGN", label: "NGN — Nigerian Naira (₦)" },
  { code: "KES", label: "KES — Kenyan Shilling (KSh)" },
  { code: "ZAR", label: "ZAR — South African Rand (R)" },
  { code: "GHS", label: "GHS — Ghanaian Cedi (₵)" },
  { code: "INR", label: "INR — Indian Rupee (₹)" },
  { code: "AED", label: "AED — UAE Dirham (د.إ)" },
  { code: "CAD", label: "CAD — Canadian Dollar (C$)" },
  { code: "AUD", label: "AUD — Australian Dollar (A$)" },
  { code: "JPY", label: "JPY — Japanese Yen (¥)" },
  { code: "SGD", label: "SGD — Singapore Dollar (S$)" },
  { code: "BRL", label: "BRL — Brazilian Real (R$)" },
];

const field =
  "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Small accessible switch used for the discount setting. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        checked ? "bg-brand-600" : "bg-zinc-300",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export default function BusinessSettingsPage() {
  const { business, updateBusiness } = useBusiness();

  const [name, setName] = useState(business.name);
  const [email, setEmail] = useState(business.email);
  const [phone, setPhone] = useState(business.phone);
  const [whatsapp, setWhatsapp] = useState(business.whatsapp);
  const [address, setAddress] = useState(business.address);
  const [currency, setCurrency] = useState(business.currency);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl);
  const [discountsEnabled, setDiscountsEnabled] = useState(business.discountsEnabled);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Database connection (Phase 5.4): load the saved business on mount,
  // save to Supabase on submit. The UI above is unchanged.
  const [dbError, setDbError] = useState<string | null>(null);
  const dirtyRef = useRef(false); // user saved before the load finished → don't overwrite

  useEffect(() => {
    let cancelled = false;
    loadBusiness().then((result) => {
      if (cancelled || dirtyRef.current) return;
      if (result.kind === "ok") {
        // Load the saved business instead of creating a duplicate.
        updateBusiness(result.business);
        setName(result.business.name);
        setEmail(result.business.email);
        setPhone(result.business.phone);
        setWhatsapp(result.business.whatsapp);
        setAddress(result.business.address);
        setCurrency(result.business.currency);
        setLogoUrl(result.business.logoUrl);
        setDiscountsEnabled(result.business.discountsEnabled);
      } else if (result.kind === "error") {
        setDbError(result.message);
      }
      // "empty" (first run — nothing saved yet) and "no-config" (offline
      // demo mode): keep the current values, nothing to show.
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  function handleLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the logo.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Please choose a logo under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your business name.");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    const input = {
      name: trimmedName,
      email: email.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      currency,
      logoUrl,
      discountsEnabled,
    };

    dirtyRef.current = true;
    const result = await saveBusiness(input);

    // Keep the app working instantly either way; the database is the
    // durable copy. Errors are reported without blocking the form.
    updateBusiness(input);

    if (result.kind === "error") {
      setError(
        "Saved on this device, but the database said: " + result.message,
      );
      setSaved(false);
      return;
    }

    setError(null);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Page heading */}
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Business Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your details once — BizFlow reuses them on your invoices and receipts.
        </p>
      </div>

      {dbError ? (
        <p role="alert" className="mb-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load your saved settings from the database: {dbError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Your business */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-zinc-900">Your business</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            This information appears on every invoice and receipt you send.
          </p>

          {/* Logo */}
          <div className="mt-5 flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview */}
                <img
                  src={logoUrl}
                  alt="Business logo"
                  className="h-16 w-16 rounded-xl border border-zinc-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  aria-label="Remove logo"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 p-1 text-white shadow hover:bg-red-600"
                >
                  <Trash2 aria-hidden className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span
                aria-hidden
                className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-100 text-lg font-semibold text-brand-700"
              >
                {initials(name || "BizFlow")}
              </span>
            )}
            <div>
              <label
                htmlFor="business-logo"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <ImagePlus aria-hidden className="h-4 w-4" />
                {logoUrl ? "Change logo" : "Upload logo"}
              </label>
              <input
                id="business-logo"
                type="file"
                accept="image/*"
                onChange={(e) => handleLogo(e.target.files?.[0])}
                className="sr-only"
              />
              <p className="mt-1.5 text-xs text-zinc-400">PNG or JPG, under 500 KB.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="biz-name" className="text-sm font-medium text-zinc-700">
                Business name
              </label>
              <input
                id="biz-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BizFlow Studio LLC"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="biz-email" className="text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="biz-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. billing@yourbusiness.com"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="biz-phone" className="text-sm font-medium text-zinc-700">
                Business phone
              </label>
              <input
                id="biz-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 (555) 123-4567"
                className={field}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="biz-whatsapp" className="text-sm font-medium text-zinc-700">
                WhatsApp number
              </label>
              <input
                id="biz-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. +1 (555) 123-4567"
                className={field}
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                Where customer messages will be sent in a future update.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="biz-address" className="text-sm font-medium text-zinc-700">
                Business address
              </label>
              <input
                id="biz-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, country"
                className={field}
              />
            </div>

            <div>
              <label htmlFor="biz-currency" className="text-sm font-medium text-zinc-700">
                Currency
              </label>
              <select
                id="biz-currency"
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
                Used for prices on your products, invoices, and receipts.
              </p>
            </div>
          </div>
        </Card>

        {/* Discounts */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-zinc-900">Discounts</h2>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">Enable discounts</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">
                When on, you can apply a percentage or fixed-amount discount while
                creating an invoice. Turn off to hide the discount option entirely.
              </p>
            </div>
            <Toggle
              checked={discountsEnabled}
              onChange={setDiscountsEnabled}
              label="Enable discounts"
            />
          </div>
        </Card>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {/* Sticky-ish save bar */}
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-surface/95 p-3 shadow-card backdrop-blur">
            {saved ? (
              <span className="mr-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Check aria-hidden className="h-4 w-4" />
                Saved — reused across BizFlow
              </span>
            ) : (
              <span className="mr-auto text-sm text-zinc-400">Changes apply right away.</span>
            )}
            <Button type="submit">Save Settings</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
