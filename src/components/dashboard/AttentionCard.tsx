"use client";

import Link from "next/link";
import { PackageSearch, ReceiptText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAttentionItems } from "@/lib/attention";

/**
 * Overview — "Needs your attention" (Phase 2). The owner shouldn't have to go
 * looking for problems: overdue invoices and low/out-of-stock products,
 * straight from the same data the notifications bell uses.
 */
export function AttentionCard() {
  const items = useAttentionItems();

  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        subtitle="Overdue invoices and stock levels BizMate is watching"
      />
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-zinc-500">
          All caught up — nothing needs your attention right now.
        </p>
      ) : (
        <ul className="border-t border-zinc-100">
          {items.map((n) => (
            <li key={n.id} className="border-b border-zinc-50 last:border-0">
              <Link
                href={n.href}
                className="flex gap-3 px-5 py-3 hover:bg-zinc-50"
              >
                {n.kind === "invoice" ? (
                  <ReceiptText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <PackageSearch aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">
                    {n.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{n.detail}</span>
                </span>
            </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
