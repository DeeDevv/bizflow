"use client";

import { useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { BusinessStep } from "./BusinessStep";
import { OwnerStep } from "./OwnerStep";
import { TeamStep } from "./TeamStep";
import { ProductStep } from "./ProductStep";
import { ReviewStep } from "./ReviewStep";
import { StepError } from "./shared";
import { useSetup } from "@/lib/setup-store";
import { saveBusiness } from "@/lib/business-db";
import { useBusiness } from "@/lib/business-store";
import { useProducts } from "@/lib/products-store";
import { cn } from "@/lib/utils";

/**
 * Phase 2 — guided business setup. Replaces the Phase-1 single-form gate
 * with a five-step flow: Business → Owner → Team → Products → Review.
 *
 * What's real vs mock (backend deliberately not built yet):
 * - The business row itself is created through the REAL saveBusiness path —
 *   currency, name, and contact details land in the database exactly as in
 *   the previous flow.
 * - Owner profile, employees, and the extended product fields are Phase-2
 *   mock/local records (setup store) — they'll move to the new Supabase
 *   project in a later phase.
 * - Core product records (name, price, stock, image) DO go into the real
 *   products catalog via addProduct, so sales/invoices work immediately.
 */

const STEPS = ["Business", "Owner", "Team", "Products", "Review"] as const;

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setup, completeSetup } = useSetup();
  const { business, updateBusiness } = useBusiness();
  const { addProduct } = useProducts();

  async function handleComplete() {
    setBusy(true);
    setError(null);

    // Safety: if a business already exists (setup re-run), never re-save or
    // duplicate — just finish the local Phase-2 records.
    if (business.id) {
      completeSetup();
      return;
    }

    const draft = setup.businessDraft;

    // 1) Create the real business row (same path as before).
    const input = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      whatsapp: draft.phone.trim(),
      address: draft.address.trim(),
      currency: draft.currency,
      logoUrl: "",
      discountsEnabled: true,
      websiteUrl: "",
    };
    const result = await saveBusiness(input);
    if (result.kind !== "ok") {
      setBusy(false);
      setError(
        result.kind === "error"
          ? "Could not save: " + result.message
          : "Could not reach the database. Please try again.",
      );
      return;
    }
    updateBusiness({ ...input, id: result.id });

    // 2) Push the setup products into the real catalog (best effort — the
    // owner can re-add any that fail; the wizard must always finish).
    for (const p of setup.products) {
      await addProduct({
        name: p.name,
        price: p.sellingPrice,
        stock: p.openingStock,
        imageUrl: "",
      });
    }

    // 3) Freeze extended fields + mark setup complete (local, Phase-2 mock).
    completeSetup();
    // The gate unmounts — the Owner Command Center renders.
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

      {/* Progress indicator */}
      <ol className="mb-5 flex items-center gap-1.5" aria-label="Setup progress">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  state === "done" && "bg-brand-600 text-white",
                  state === "current" && "bg-brand-50 text-brand-700 ring-2 ring-brand-500",
                  state === "todo" && "bg-zinc-100 text-zinc-400",
                )}
              >
                {state === "done" ? (
                  <Check aria-hidden className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  state === "todo" ? "text-zinc-400" : "text-zinc-600",
                )}
              >
                {label}
                <span className="sr-only">
                  {state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="mb-4">
          <StepError message={error} />
        </div>
      ) : null}

      {/* Steps */}
      {step === 0 ? <BusinessStep onNext={() => setStep(1)} /> : null}
      {step === 1 ? (
        <OwnerStep onBack={() => setStep(0)} onNext={() => setStep(2)} />
      ) : null}
      {step === 2 ? (
        <TeamStep onBack={() => setStep(1)} onNext={() => setStep(3)} />
      ) : null}
      {step === 3 ? (
        <ProductStep
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          onSkip={() => setStep(4)}
        />
      ) : null}
      {step === 4 ? (
        <ReviewStep onBack={() => setStep(3)} onGoToBizMate={handleComplete} busy={busy} />
      ) : null}
    </div>
  );
}
