"use client";

import { useMemo } from "react";
import { useProducts } from "@/lib/products-store";
import { useInvoices } from "@/lib/invoices-store";
import { effectiveStatus } from "@/lib/invoice-utils";
import { useActiveNotifications } from "@/lib/domain/notifications";

/**
 * "What needs my attention?" — the single source behind the Topbar bell and
 * the Overview attention card.
 *
 * Phase 4: condition notifications come from the automation engine
 * (low-stock/out-of-stock transitions, outstanding balances — spam-proof,
 * idempotent per condition). Overdue invoices stay computed live here
 * (date-driven, no event needed). BizMate notices; the owner reads.
 */

export type AttentionItem = {
  id: string;
  kind: "invoice" | "stock" | "balance";
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
    for (const n of engineNotes) {
      notes.push({
        id: n.id,
        kind: n.kind === "outstanding_balance" ? "balance" : "stock",
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
    //    the engine has processed anything (same thresholds as the engine).
    for (const p of products) {
      const already = notes.some(
        (n) => n.kind === "stock" && n.title.startsWith(p.name),
      );
      if (already) continue;
      if (p.stock <= 0) {
        notes.push({
          id: "live-stock-" + p.id,
          kind: "stock",
          title: `${p.name} is out of stock`,
          detail: "Restock before selling more of this product.",
          href: "/dashboard/employee/receive-stock",
        });
      } else if (p.stock <= 5) {
        notes.push({
          id: "live-stock-" + p.id,
          kind: "stock",
          title: `${p.name} is running low`,
          detail: `Only ${p.stock} left in stock.`,
          href: "/dashboard/employee/inventory",
        });
      }
    }

    return notes.slice(0, 8);
  }, [engineNotes, products, invoices]);
}
