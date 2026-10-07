"use client";

import { useMemo } from "react";
import { useProducts } from "@/lib/products-store";
import { useInvoices } from "@/lib/invoices-store";
import { effectiveStatus } from "@/lib/invoice-utils";
import { useActiveNotifications } from "@/lib/domain/notifications";
import { stockStatus } from "@/lib/domain/stock-state";

/**
 * "What needs my attention?" — the single source behind the Topbar bell and
 * the Overview attention card.
 *
 * Phase 4: condition notifications come from the automation engine
 * (low-stock/out-of-stock transitions, outstanding balances — spam-proof,
 * idempotent per condition). Overdue invoices stay computed live here
 * (date-driven, no event needed). BizMate notices; the owner reads.
 *
 * Phase 8: severity now comes from the notification record itself
 * (report ready = info, low stock = warning, out of stock = critical) —
 * one severity source, not a per-view re-derivation. Report-ready notices
 * are informational, not conditions, so they don't appear here (they show
 * in the bell with their own info styling and in the Daily Business Update).
 *
 * The live stock fallback uses the SAME stock-state thresholds as the
 * engine (Phase 5 consolidation) — no second algorithm.
 */

export type AttentionItem = {
  id: string;
  kind: "invoice" | "stock" | "balance" | "attendance";
  /** Clear priority label, not a numeric score: out-of-stock is critical. */
  severity?: "critical" | "important";
  title: string;
  detail: string;
  href: string;
};

export function useAttentionItems(): AttentionItem[] {
  const { products } = useProducts();
  const { invoices } = useInvoices();
  const engineNotes = useActiveNotifications();

  return useMemo(() => {
    const notes: AttentionItem[] = [];

    // 1) Engine-raised condition notifications (deduped, resolved state-aware).
    //    Severity was decided once, by the engine, when the condition was raised.
    for (const n of engineNotes) {
      // Informational notices (report ready, inventory arrivals, follow-up
      // nudges) belong to the bell and their own boards — not conditions.
      if (
        n.kind === "report_ready" ||
        n.kind === "new_inventory" ||
        n.kind === "followup"
      )
        continue;
      const subject = products.find((p) => p.id === n.subjectId);
      notes.push({
        id: n.id,
        kind:
          n.kind === "outstanding_balance" || n.kind === "payment_partial"
            ? "balance"
            : n.kind === "attendance"
              ? "attendance"
              : "stock",
        // A stock condition record whose product is NOW out is critical even
        // if the stored notice was raised as low-stock warning.
        severity:
          n.severity === "critical" ||
          (subject && stockStatus(subject) === "out")
            ? "critical"
            : "important",
        title: n.title,
        detail: n.detail,
        href: n.href,
      });
    }

    // 2) Overdue invoices (live date-driven; the engine doesn't watch dates).
    for (const inv of invoices) {
      if (effectiveStatus(inv) === "overdue") {
        notes.push({
          id: "inv-" + inv.id,
          kind: "invoice",
          title: `${inv.number} is overdue`,
          detail: "This invoice is past its due date and still unpaid.",
          href: "/dashboard/invoices/" + inv.id,
        });
      }
    }

    // 3) Live stock fallback so the bell is never empty on first load before
    //    the engine has processed anything. Same stock-state logic as the
    //    engine (single threshold source).
    for (const p of products) {
      const already = notes.some(
        (n) => n.kind === "stock" && n.title.startsWith(p.name),
      );
      if (already) continue;
      const status = stockStatus(p);
      if (status === "out") {
        notes.push({
          id: "live-stock-" + p.id,
          kind: "stock",
          severity: "critical",
          title: `${p.name} is out of stock`,
          detail: "Restock before selling more of this product.",
          href: `/dashboard/employee/inventory/${p.id}`,
        });
      } else if (status === "low") {
        notes.push({
          id: "live-stock-" + p.id,
          kind: "stock",
          severity: "important",
          title: `${p.name} is running low`,
          detail: `Only ${p.stock} left in stock.`,
          href: `/dashboard/employee/inventory/${p.id}`,
        });
      }
    }

    return notes.slice(0, 8);
  }, [engineNotes, products, invoices]);
}
