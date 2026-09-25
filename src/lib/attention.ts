"use client";

import { useMemo } from "react";
import { useProducts } from "@/lib/products-store";
import { useInvoices } from "@/lib/invoices-store";
import { effectiveStatus } from "@/lib/invoice-utils";

/**
 * "What needs my attention?" — the single source behind the Topbar bell and
 * the Overview attention card: overdue invoices and low/out-of-stock products,
 * computed live from the business's real data. BizMate notices these things
 * so the owner doesn't have to go looking.
 */

export type AttentionItem = {
  id: string;
  kind: "invoice" | "stock";
  title: string;
  detail: string;
  href: string;
};

export function useAttentionItems(): AttentionItem[] {
  const { products } = useProducts();
  const { invoices } = useInvoices();

  return useMemo(() => {
    const notes: AttentionItem[] = [];

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

    for (const p of products) {
      if (p.stock <= 0) {
        notes.push({
          id: "stock-" + p.id,
          kind: "stock",
          title: `${p.name} is out of stock`,
          detail: "Restock before selling more of this product.",
          href: "/dashboard/products",
        });
      } else if (p.stock <= 5) {
        notes.push({
          id: "stock-" + p.id,
          kind: "stock",
          title: `${p.name} is running low`,
          detail: `Only ${p.stock} left in stock.`,
          href: "/dashboard/products",
        });
      }
    }

    return notes.slice(0, 8);
  }, [products, invoices]);
}
