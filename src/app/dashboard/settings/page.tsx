"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe, ImagePlus, MapPin, Sparkles, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useBusiness } from "@/lib/business-store";
import { loadBusiness, saveBusiness } from "@/lib/business-db";
import { useSetup } from "@/lib/setup-store";
import { cn, isValidWebsiteUrl, normalizeWebsiteUrl } from "@/lib/utils";
import { CURRENCIES } from "@/lib/currencies";
import { AUTOMATION_RULES } from "@/lib/domain/automation-rules";
import { capturePosition } from "@/lib/domain/attendance";

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

/** www.daoelectronics.com — for display only; links keep the full URL. */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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
  const { setup, setWorkplace, setStartingCapital } = useSetup();

  // Workplace Attendance Verification (Phase 8.5, spec §3): the owner
  // registers WHERE work happens, and how far "at work" may be.
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const workplace = setup.workplace;

  async function captureWorkplace() {
    setLocBusy(true);
    setLocMsg(null);
    const position = await capturePosition();
    setLocBusy(false);
    if (!position.ok) {
      setLocMsg(
        "Could not capture your location — allow location access and try again.",
      );
      return;
    }
    setWorkplace({
      lat: position.latitude,
      lng: position.longitude,
      radiusMeters: workplace?.radiusMeters ?? 100,
      capturedAt: new Date().toISOString(),
    });
    setLocMsg("Workplace location saved.");
  }

  const [name, setName] = useState(business.name);
  const [email, setEmail] = useState(business.email);
  const [phone, setPhone] = useState(business.phone);
  const [whatsapp, setWhatsapp] = useState(business.whatsapp);
  const [address, setAddress] = useState(business.address);
  const [currency, setCurrency] = useState(business.currency);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl);
  const [discountsEnabled, setDiscountsEnabled] = useState(business.discountsEnabled);

  // Starting Business Capital (Phase 8.6, spec §9): informational figure
  // saved with the setup store; the financial overview reads it from there.
  const [capitalInput, setCapitalInput] = useState(
    setup.startingCapital === null ? "" : String(setup.startingCapital),
  );

  // Business Website: the Yes/No answer, the editable URL field, and the URL
  // currently connected (shown as the read-only link until edited/removed).
  const [hasWebsite, setHasWebsite] = useState(Boolean(business.websiteUrl));
  const [websiteInput, setWebsiteInput] = useState(business.websiteUrl);
  const [connectedUrl, setConnectedUrl] = useState(business.websiteUrl);
  const [editingWebsite, setEditingWebsite] = useState(false);

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
        setWebsiteInput(result.business.websiteUrl);
        setHasWebsite(Boolean(result.business.websiteUrl));
        setConnectedUrl(result.business.websiteUrl);
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

    // Business Website: "No" saves without a URL; "Yes" requires a valid one.
    const normalizedUrl = normalizeWebsiteUrl(websiteInput);
    if (hasWebsite && !normalizedUrl) {
      setError("Please enter your website URL, or choose \u201cNo\u201d if you don\u2019t have one yet.");
      return;
    }
    if (hasWebsite && !isValidWebsiteUrl(normalizedUrl)) {
      setError("Please enter a valid website URL, e.g. https://example.com");
      return;
    }
    const finalWebsiteUrl = hasWebsite ? normalizedUrl : "";

    const input = {
      name: trimmedName,
      email: email.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      currency,
      logoUrl,
      discountsEnabled,
      websiteUrl: finalWebsiteUrl,
    };

    dirtyRef.current = true;
    const result = await saveBusiness(input);

    // Starting Business Capital (Phase 8.6, spec §9): parse the typed
    // figure and persist via the setup store alongside the other settings.
    const capitalDigits = capitalInput.replace(/[^0-9]/g, "");
    setStartingCapital(capitalDigits ? Number(capitalDigits) : null);

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
    setConnectedUrl(finalWebsiteUrl); // the saved URL is now the connected one
    setEditingWebsite(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }

  /** Remove the connected website right away (clears it in the database). */
  async function handleRemoveWebsite() {
    const input = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      currency,
      logoUrl,
      discountsEnabled,
      websiteUrl: "",
    };
    const result = await saveBusiness(input);
    updateBusiness(input);
    setHasWebsite(false);
    setWebsiteInput("");
    setConnectedUrl("");
    setEditingWebsite(false);
    if (result.kind === "error") {
      setError("Removed on this device, but the database said: " + result.message);
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
          Enter your details once — BizMate reuses them on your invoices and receipts.
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
                {initials(name || "BizMate")}
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
                placeholder="e.g. Dao Electronics Ltd"
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

        {/* Business Website (Phase 8 — account → saved external URL only) */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-zinc-900">Business Website</h2>

          {connectedUrl && !editingWebsite ? (
            /* Connected: show the clickable site with Visit / Edit / Remove */
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Connected website
                </p>
                <a
                  href={connectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {prettyUrl(connectedUrl)}
                </a>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={connectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-surface px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Globe aria-hidden className="h-3.5 w-3.5" />
                  Visit Website
                </a>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setWebsiteInput(connectedUrl);
                    setEditingWebsite(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRemoveWebsite}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            /* Not connected (or editing): the Yes/No question */
            <div className="mt-3">
              <p className="text-sm font-medium text-zinc-900">
                Do you already have a business website?
              </p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  aria-pressed={hasWebsite}
                  onClick={() => setHasWebsite(true)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    hasWebsite
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  Yes, I have a website
                </button>
                <button
                  type="button"
                  aria-pressed={!hasWebsite}
                  onClick={() => setHasWebsite(false)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    !hasWebsite
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  No, I don’t have a website
                </button>
              </div>

              {hasWebsite ? (
                <div className="mt-4">
                  <label htmlFor="biz-website" className="text-sm font-medium text-zinc-700">
                    Website URL
                  </label>
                  <input
                    id="biz-website"
                    type="url"
                    inputMode="url"
                    value={websiteInput}
                    onChange={(e) => setWebsiteInput(e.target.value)}
                    placeholder="https://example.com"
                    className={field}
                  />
                  <p className="mt-1.5 text-xs text-zinc-400">
                    We’ll save this to your BizMate profile. Future updates can
                    connect it to your stock and orders.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  No problem — BizMate works fine without one. You can add a
                  website anytime from this page.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Workplace Attendance Verification (Phase 8.5, spec §3) */}
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
            Workplace Attendance Verification
          </h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            Register where work happens. When an employee taps Start Work,
            BizMate checks — once, only then — how far they are from here.
            Location is never tracked continuously.
          </p>
          {workplace ? (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm">
              <p className="font-medium text-emerald-800">Workplace registered</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {workplace.lat.toFixed(5)}, {workplace.lng.toFixed(5)} · radius{" "}
                {workplace.radiusMeters}m
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              No workplace registered — attendance will record “Unable to
              verify” until you capture it.
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => void captureWorkplace()}
              disabled={locBusy}
            >
              <MapPin aria-hidden className="h-4 w-4" />
              {locBusy
                ? "Getting location…"
                : workplace
                  ? "Re-capture location"
                  : "Capture workplace location"}
            </Button>
            {workplace ? (
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                Radius (m)
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={workplace.radiusMeters}
                  onChange={(e) => {
                    const r = Number.parseInt(e.target.value, 10);
                    if (Number.isInteger(r) && r >= 10) {
                      setWorkplace({ ...workplace, radiusMeters: r });
                    }
                  }}
                  className="w-20 rounded-lg border border-zinc-300 bg-surface px-2 py-1 text-xs tabular-nums"
                />
              </label>
            ) : null}
          </div>
          {locMsg ? <p className="mt-2 text-xs text-zinc-500">{locMsg}</p> : null}
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

        {/* Starting Business Capital (Phase 8.6, spec §9) — informational.
            Saved via the setup store; the financial overview reads it. */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            Starting Business Capital
          </h2>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">
                The money you started the business with. BizMate shows it on the
                financial overview next to your stock value, sales and profit — it is
                never changed automatically.
              </p>
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label htmlFor="starting-capital" className="text-sm font-medium text-zinc-700">
              Starting capital ({currency || "NGN"})
            </label>
            <input
              id="starting-capital"
              type="text"
              inputMode="decimal"
              value={capitalInput}
              onChange={(e) => setCapitalInput(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="e.g. 10000000"
              className={field}
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
                Saved — reused across BizMate
              </span>
            ) : (
              <span className="mr-auto text-sm text-zinc-400">Changes apply right away.</span>
            )}
            <Button type="submit">Save Settings</Button>
          </div>
        </div>
      </form>

      {/* How BizMate works for you (Phase 8): the WHEN/CHECK/DO structure,
          in owner words. Read-only — the active rules ARE the engine's real
          behavior, not settings; the rest are part of the design, honestly
          marked as coming later. */}
      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-zinc-900">
            How BizMate works for you
          </h2>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          The rules BizMate follows — when something happens, what it checks
          against your own setup, and what it does about it.
        </p>
        <ul className="mt-4 divide-y divide-zinc-100">
          {AUTOMATION_RULES.map((rule) => (
            <li key={rule.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{rule.name}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                    <span className="font-semibold text-zinc-700">When</span> {rule.trigger}
                    {rule.status === "active" ? (
                      <>
                        , <span className="font-semibold text-zinc-700">check</span>{" "}
                        {rule.check}
                      </>
                    ) : null}
                    , <span className="font-semibold text-zinc-700">BizMate will</span>{" "}
                    {rule.action}.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    rule.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {rule.status === "active" ? "Always on" : "Coming later"}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
          Alerts reach you in your BizMate notifications today. WhatsApp and
          email delivery are planned for a later phase.
        </p>
      </Card>
    </div>
  );
}
