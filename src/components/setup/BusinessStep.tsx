"use client";

import { useState } from "react";
import {
  HardHat,
  MessageCircle,
  Palette,
  Scissors,
  Shapes,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CURRENCIES } from "@/lib/currencies";
import { BUSINESS_TYPES } from "@/lib/business-types";
import type { LucideIcon } from "lucide-react";
import { useSetup } from "@/lib/setup-store";
import { StepError, field } from "./shared";
import { cn } from "@/lib/utils";

/**
 * Step 1 — Business Information: name, type, contact details, currency.
 * Name, type, and currency are what BizMate genuinely needs; the rest is
 * optional and printed on invoices later.
 */

const TYPE_ICONS: Record<string, LucideIcon> = {
  retail: Store,
  wholesale: Truck,
  food: UtensilsCrossed,
  beauty: Scissors,
  repair: Wrench,
  agency: Palette,
  construction: HardHat,
  online: MessageCircle,
  other: Shapes,
};

export function BusinessStep({ onNext }: { onNext: () => void }) {
  const { setup, setBusinessType, setBusinessDraft } = useSetup();
  const draft = setup.businessDraft;
  const [error, setError] = useState<string | null>(null);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!setup.businessType) {
      setError("Please choose the type of business you run.");
      return;
    }
    onNext();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Tell us about your business
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        This is printed on your invoices and receipts. You can change it anytime
        in Settings.
      </p>

      <form onSubmit={handleNext} noValidate className="mt-5 space-y-5">
        <div>
          <label htmlFor="setup-biz-name" className="text-sm font-medium text-zinc-700">
            Business name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input
            id="setup-biz-name"
            type="text"
            value={draft.name}
            onChange={(e) => setBusinessDraft({ name: e.target.value })}
            placeholder="e.g. David Electronics Ltd"
            autoFocus
            className={field}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-700">
            Business type <span aria-hidden className="text-red-500">*</span>
          </legend>
          <p className="mt-0.5 text-xs text-zinc-400">
            Helps BizMate use the right words for how you work.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUSINESS_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.value] ?? Shapes;
              const selected = setup.businessType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBusinessType(t.value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                      : "border-zinc-200 bg-surface text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                  )}
                >
                  <Icon aria-hidden className={cn("h-4 w-4", selected ? "text-brand-600" : "text-zinc-400")} />
                  <span className="font-medium leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="setup-biz-phone" className="text-sm font-medium text-zinc-700">
              Business phone <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="setup-biz-phone"
              type="tel"
              value={draft.phone}
              onChange={(e) => setBusinessDraft({ phone: e.target.value })}
              placeholder="e.g. +234 801 234 5678"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="setup-biz-email" className="text-sm font-medium text-zinc-700">
              Business email <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="setup-biz-email"
              type="email"
              value={draft.email}
              onChange={(e) => setBusinessDraft({ email: e.target.value })}
              placeholder="e.g. hello@yourbusiness.com"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="setup-biz-address" className="text-sm font-medium text-zinc-700">
            Business address <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="setup-biz-address"
            type="text"
            value={draft.address}
            onChange={(e) => setBusinessDraft({ address: e.target.value })}
            placeholder="Street, city"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="setup-biz-currency" className="text-sm font-medium text-zinc-700">
            Currency <span aria-hidden className="text-red-500">*</span>
          </label>
          <select
            id="setup-biz-currency"
            value={draft.currency}
            onChange={(e) => setBusinessDraft({ currency: e.target.value })}
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

        {error ? <StepError message={error} /> : null}

        <div className="flex justify-end pt-1">
          <Button type="submit">
            Continue
          </Button>
        </div>
      </form>
    </Card>
  );
}
