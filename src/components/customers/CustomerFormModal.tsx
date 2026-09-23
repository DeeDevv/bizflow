"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCustomers } from "@/lib/customers-store";
import type { Customer, CustomerInput } from "@/lib/types";

interface CustomerFormModalProps {
  /** Present = edit mode; absent = add mode */
  customer?: Customer;
  onClose: () => void;
  /** Optional callback fired after a successful add (not fired on edit). */
  onCreated?: (created: Customer) => void;
}

/** Add / Edit customer dialog with the three fields that matter. */
export function CustomerFormModal({ customer, onClose, onCreated }: CustomerFormModalProps) {
  const { addCustomer, updateCustomer } = useCustomers();
  const [values, setValues] = useState<CustomerInput>({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  const isEdit = customer != null;

  useEffect(() => {
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastActiveRef.current?.focus();
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    const email = values.email.trim();

    if (!name) {
      setError("Please enter a name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Save to the database first; only close on success so the owner's
    // input is never lost to a failed save.
    const details = { name, email, phone: values.phone.trim() };
    const saved = isEdit
      ? await updateCustomer(customer.id, details)
      : await addCustomer(details);
    if (!saved) {
      setError("Could not save — please try again in a moment.");
      return;
    }
    if (!isEdit) onCreated?.(saved);
    onClose();
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit customer" : "Add customer"}
        className="animate-rise-in relative w-full max-w-md rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? "Edit Customer" : "Add Customer"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit ? "Update this customer's details." : "Add someone you do business with."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label htmlFor="customer-name" className="text-sm font-medium text-zinc-700">
              Name
            </label>
            <input
              id="customer-name"
              ref={firstFieldRef}
              type="text"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="e.g. Sarah Whitfield"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="customer-email" className="text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="customer-email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              placeholder="e.g. sarah@company.com"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="customer-phone" className="text-sm font-medium text-zinc-700">
              Phone <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="customer-phone"
              type="tel"
              value={values.phone}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              placeholder="e.g. +1 (555) 123-4567"
              className={field}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save Changes" : "Add Customer"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
