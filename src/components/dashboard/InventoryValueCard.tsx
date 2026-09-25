"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useProducts } from "@/lib/products-store";
import { useSetup } from "@/lib/setup-store";
import { useBusiness } from "@/lib/business-store";
import { formatMoneyWhole } from "@/lib/currency-symbol";

/**
 * Overview — inventory value at cost (Phase 2). What the owner paid for the
 * stock currently on the shelf; profit happens when it sells. Cost prices
 * come from setup (productExtras, keyed by name) — this stays an owner-level
 * figure: cost price is hidden from ordinary employees later.
 */
export function InventoryValueCard() {
  const { products } = useProducts();
  const { setup } = useSetup();
  const { business } = useBusiness();

  const total = products.reduce((sum, p) => {
    const cost = setup.productExtras[p.name]?.costPrice;
    return cost !== undefined && cost !== null ? sum + cost * p.stock : sum;
  }, 0);

  const priced = products.some((p) => {
    const cost = setup.productExtras[p.name]?.costPrice;
    return cost !== undefined && cost !== null;
  });

  return (
    <Card>
      <CardHeader
        title="Inventory value (at cost)"
        subtitle="What the stock on your shelf cost you"
        action={<Wallet aria-hidden className="h-4 w-4 text-zinc-400" />}
      />
      <p className="px-5 pb-5 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {products.length === 0
          ? "—"
          : priced
            ? formatMoneyWhole(total, business.currency || "NGN")
            : "Add cost prices in setup to see this"}
      </p>
      {products.length > 0 && priced ? (
        <p className="-mt-3 px-5 pb-4 text-xs text-zinc-400">
          <Link href="/dashboard/products" className="hover:text-zinc-600">
            Based on your product cost prices
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
