"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSetup } from "@/lib/setup-store";
import { useAuth } from "@/lib/auth-store";
import { StepError, field } from "./shared";

/**
 * Step 2 — Owner Profile. The owner role is implied, never selected: the UI
 * simply says "You are the business owner." Email is prefilled from the
 * signed-in account when available.
 */

export function OwnerStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const { setup, setOwner } = useSetup();
  const owner = setup.owner;
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Prefill once from the signed-in account (demo mode has no user — skip).
  useEffect(() => {
    if (!owner.email && user?.email) setOwner({ email: user.email });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill on first mount only
  }, []);

  function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Please choose an image under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setOwner({ photoUrl: String(reader.result) });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!owner.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!owner.email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    onNext();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Who runs the business?
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        We&apos;ll set up your owner profile. Employees are added on the next
        step.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5">
        <BadgeCheck aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-sm font-medium text-brand-700">
          You are the business owner — you always have full access.
        </p>
      </div>

      <form onSubmit={handleNext} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor="setup-owner-name" className="text-sm font-medium text-zinc-700">
            Full name <span aria-hidden className="text-red-500">*</span>
          </label>
          <input
            id="setup-owner-name"
            type="text"
            value={owner.name}
            onChange={(e) => setOwner({ name: e.target.value })}
            placeholder="e.g. David Okafor"
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="setup-owner-email" className="text-sm font-medium text-zinc-700">
              Email <span aria-hidden className="text-red-500">*</span>
            </label>
            <input
              id="setup-owner-email"
              type="email"
              value={owner.email}
              onChange={(e) => setOwner({ email: e.target.value })}
              placeholder="you@yourbusiness.com"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="setup-owner-phone" className="text-sm font-medium text-zinc-700">
              Phone number <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="setup-owner-phone"
              type="tel"
              value={owner.phone}
              onChange={(e) => setOwner({ phone: e.target.value })}
              placeholder="e.g. +234 801 234 5678"
              className={field}
            />
          </div>
        </div>

        {/* Optional profile photo */}
        <div>
          <span className="text-sm font-medium text-zinc-700">
            Profile photo <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          <div className="mt-2 flex items-center gap-3">
            {owner.photoUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview */}
                <img
                  src={owner.photoUrl}
                  alt="Owner preview"
                  className="h-14 w-14 rounded-full border border-zinc-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setOwner({ photoUrl: "" })}
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 p-1 text-white shadow hover:bg-red-600"
                >
                  <Trash2 aria-hidden className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-400"
              >
                {owner.name.trim() ? owner.name.trim()[0].toUpperCase() : "?"}
              </span>
            )}
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {owner.photoUrl ? "Change photo" : "Upload photo"}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
              className="sr-only"
            />
          </div>
        </div>

        {error ? <StepError message={error} /> : null}

        <div className="flex justify-between pt-1">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </Card>
  );
}
