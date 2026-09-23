"use client";

import { useMemo, useState } from "react";
import { PackageOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ProductFormModal,
} from "@/components/products/ProductFormModal";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { useProducts } from "@/lib/products-store";
import { useBusiness } from "@/lib/business-store";
import type { Product } from "@/lib/types";
import { formatNumber, cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";

/** Human-friendly stock line, e.g. "12 in stock". */
function stockLabel(stock: number): string {
  if (stock <= 0) return "Out of stock";
  return `${formatNumber(stock)} in stock`;
}

/** Visual status for the stock badge. */
function stockTone(stock: number): "ok" | "low" | "out" {
  if (stock <= 0) return "out";
  if (stock <= 5) return "low";
  return "ok";
}

const toneClasses: Record<"ok" | "low" | "out", string> = {
  ok: "bg-emerald-50 text-emerald-700",
  low: "bg-amber-50 text-amber-700",
  out: "bg-red-50 text-red-700",
};

const toneLabel: Record<"ok" | "low" | "out", string> = {
  ok: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProductsPage() {
  const { products, status, error, reload, clearError, deleteProduct } =
    useProducts();
  const { business } = useBusiness();
  const [query, setQuery] = useState("");
  const [formTarget, setFormTarget] = useState<"new" | Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page heading */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Products</h1>
          <p className="mt-1 text-sm text-zinc-500">
            What you sell. Names and prices here are reused on invoices.
          </p>
        </div>
        <Button onClick={() => setFormTarget("new")}>
          <Plus aria-hidden className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Database status — same alert styles used elsewhere in the app */}
      {status === "error" && error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Could not load your products: {error}</span>
          <button
            type="button"
            onClick={reload}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}
      {status === "ready" && error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>Something did not save: {error}</span>
          <button
            type="button"
            onClick={clearError}
            className="rounded-md px-2 py-1 text-sm font-medium text-red-700 underline hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Search */}
      <div className="pb-4">
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
            aria-label="Search products"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-surface pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="px-5 py-14 text-center">
            <PackageOpen aria-hidden className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm font-medium text-zinc-900">
              {query ? "No products match your search" : "No products yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {query
                ? "Try a different name."
                : "Add your first product — its price will be reused on invoices."}
            </p>
            {!query ? (
              <Button className="mt-5" onClick={() => setFormTarget("new")}>
                <Plus aria-hidden className="h-4 w-4" />
                Add Product
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 text-right font-medium">Selling price</th>
                  <th className="px-5 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-5 py-2.5 text-right font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((product) => (
                  <tr key={product.id} className="group transition-colors hover:bg-zinc-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local data-URL / mock image
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700"
                          >
                            {initials(product.name)}
                          </span>
                        )}
                        <span className="font-medium text-zinc-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatMoney(product.price, business.currency)}
                      <span className="sr-only"> per unit</span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-zinc-600">
                      {stockLabel(product.stock)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          toneClasses[stockTone(product.stock)],
                        )}
                      >
                        {toneLabel[stockTone(product.stock)]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => setFormTarget(product)}
                          aria-label={`Edit ${product.name}`}
                          className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Pencil aria-hidden className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          aria-label={`Delete ${product.name}`}
                          className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-y divide-zinc-100 md:hidden">
            {filtered.map((product) => (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3.5">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data-URL / mock image
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg border border-zinc-200 object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700"
                  >
                    {initials(product.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{product.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{stockLabel(product.stock)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">
                    {formatMoney(product.price, business.currency)}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      toneClasses[stockTone(product.stock)],
                    )}
                  >
                    {toneLabel[stockTone(product.stock)]}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setFormTarget(product)}
                    aria-label={`Edit ${product.name}`}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Pencil aria-hidden className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(product)}
                    aria-label={`Delete ${product.name}`}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Add / Edit dialog */}
      {formTarget ? (
        <ProductFormModal
          product={formTarget === "new" ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {/* Delete confirmation */}
      {deleteTarget ? (
        <DeleteProductDialog
          product={deleteTarget}
          onConfirm={() => void deleteProduct(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
