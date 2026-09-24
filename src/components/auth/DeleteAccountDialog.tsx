"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface DeleteAccountDialogProps {
  email: string;
  businessName: string;
  onClose: () => void;
}

/**
 * Final confirmation before permanently deleting the signed-in account.
 * Follows the same dialog pattern as DeleteCustomerDialog (Escape, click-
 * away, focus moves to Cancel, body scroll locked). The deletion itself is
 * one database call (migration 0011 `delete_my_account`) that removes the
 * business data and the auth user atomically.
 */
export function DeleteAccountDialog({
  email,
  businessName,
  onClose,
}: DeleteAccountDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastActiveRef.current?.focus();
    };
  }, [onClose, busy]);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const { getSupabaseClient, isSupabaseConfigured } = await import(
        "@/lib/supabase"
      );
      if (!isSupabaseConfigured) {
        setError("BizFlow is not connected to the database.");
        setBusy(false);
        return;
      }
      const { error: rpcError } = await getSupabaseClient().rpc(
        "delete_my_account",
      );
      if (rpcError) {
        setError(
          "Could not delete your account: " +
            rpcError.message +
            " — please try again.",
        );
        setBusy(false);
        return;
      }
      // Account (and data) gone: full navigation clears the cookie session
      // and every in-memory store, then login explains what happened.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?deleted=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={busy ? undefined : onClose}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete account"
        className="animate-rise-in relative w-full max-w-sm rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold text-zinc-900">
          Delete your account?
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This permanently deletes{" "}
          <span className="font-medium text-zinc-900">{email}</span>
          {businessName ? (
            <>
              {" "}
              and <span className="font-medium text-zinc-900">{businessName}</span>
            </>
          ) : null}
          , including all products, customers, invoices, payments, and
          receipts. <span className="font-medium text-zinc-900">This cannot be undone.</span>
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleDelete()}
            disabled={busy}
            className="bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
          >
            {busy ? "Deleting account…" : "Delete my account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
