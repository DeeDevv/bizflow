"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/types";

interface DeleteCustomerDialogProps {
  customer: Customer;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation before removing a customer. */
export function DeleteCustomerDialog({
  customer,
  onConfirm,
  onClose,
}: DeleteCustomerDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete customer"
        className="animate-rise-in relative w-full max-w-sm rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold text-zinc-900">Delete customer?</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This will remove <span className="font-medium text-zinc-900">{customer.name}</span>{" "}
          from your customer list. Their sales and invoices stay in your history.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
