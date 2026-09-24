"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getOrCreateReceiptForPayment } from "@/lib/receipts-db";

/**
 * Get-or-create handler: /dashboard/receipts/new?payment=<id> creates the
 * payment's receipt if it does not exist (the database function is
 * idempotent — a payment can never end up with two), then shows it.
 *
 * The part that reads the query string lives inside a Suspense boundary
 * so the page can still be prerendered at build time.
 */
export default function NewReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl py-20 text-center">
          <p className="text-sm text-zinc-500">Preparing your receipt…</p>
          <p className="mt-2 text-xs text-zinc-400">
            <Link href="/dashboard/invoices" className="underline hover:text-zinc-600">
              Back to invoices
            </Link>
          </p>
        </div>
      }
    >
      <NewReceiptContent />
    </Suspense>
  );
}

function NewReceiptContent() {
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const missingPayment = !paymentId;

  useEffect(() => {
    if (started.current || missingPayment) return;
    started.current = true;
    getOrCreateReceiptForPayment(paymentId!).then((result) => {
      if (result.kind === "ok") {
        router.replace(`/dashboard/receipts/${result.receiptId}`);
      } else if (result.kind === "error") {
        setError(result.message);
      } else {
        setError("BizMate is not connected to the database.");
      }
    });
  }, [paymentId, missingPayment, router]);

  if (missingPayment) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">
          No payment selected
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Open an invoice and click Receipt on a payment.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/invoices")}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Could not open the receipt</p>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
        <Button className="mt-6" onClick={() => history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-20 text-center">
      <p className="text-sm text-zinc-500">Preparing your receipt…</p>
      <p className="mt-2 text-xs text-zinc-400">
        <Link href="/dashboard/invoices" className="underline hover:text-zinc-600">
          Back to invoices
        </Link>
      </p>
    </div>
  );
}
