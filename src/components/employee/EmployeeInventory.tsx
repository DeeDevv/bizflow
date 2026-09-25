"use client";

import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useProducts } from "@/lib/products-store";
import { stockStatus, stockStatusLabel } from "@/lib/stock-level";
import { productCategory, productCode } from "./NewSale";
import { cn } from "@/lib/utils";

/**
 * Employee inventory (Phase 3) — a simple stock view: what we have, how
 * much, and its status. The owner keeps their fuller Products page.
 */
export function EmployeeInventory() {
  const { products } = useProducts();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, productCode(p.name), productCategory(p.name), p.name]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [products, query]);

  return (
    <div>
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Inventory
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Current stock at a glance.</p>
      </div>

      <div className="relative max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          aria-label="Search inventory"
          className="w-full rounded-lg border border-zinc-300 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {rows.length === 0 ? (
        <Card className="mt-4 px-6 py-12 text-center">
          <PackageSearch aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">No products found</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {products.length === 0
              ? "Products added during setup appear here."
              : "Try a different name, code, or category."}
          </p>
        </Card>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-surface shadow-card">
          {rows.map((p) => {
            const status = stockStatus(p);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {[productCode(p.name), productCategory(p.name)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                  {p.stock}
                </p>
                <span
                  className={cn(
                    "w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium",
                    status === "out" && "bg-red-50 text-red-700",
                    status === "low" && "bg-amber-50 text-amber-700",
                    status === "in" && "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {stockStatusLabel[status]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
