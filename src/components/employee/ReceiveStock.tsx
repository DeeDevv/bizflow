"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useProducts } from "@/lib/products-store";
import { recordStockReceipt } from "@/lib/stock-level";
import { recordActivity } from "@/lib/activity-store";
import { currentEmployeeName } from "@/lib/employee-session";

/**
 * Receive Stock (Phase 3 foundation) — pick a product, record the quantity
 * that arrived, confirm. Updates the displayed stock locally for now; the
 * real inventory movement is a Phase 4 automation.
 */
export function ReceiveStock() {
  const { products, updateProduct } = useProducts();
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; added: number; newStock: number } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const picked = products.find((p) => p.id === pickedId) ?? null;

  async function confirm() {
    if (!picked || qty <= 0) return;
    setBusy(true);
    await updateProduct(picked.id, {
      name: picked.name,
      price: picked.price,
      stock: picked.stock + qty,
      imageUrl: picked.imageUrl,
    });
    recordStockReceipt({
      productId: picked.id,
      productName: picked.name,
      quantity: qty,
      actor: currentEmployeeName(),
    });
    recordActivity({
      kind: "stock_received",
      actor: currentEmployeeName(),
      label: `received ${qty} × ${picked.name}`,
      productId: picked.id,
    });
    setBusy(false);
    setDone({ name: picked.name, added: qty, newStock: picked.stock + qty });
    setPickedId(null);
    setQty(1);
    setQuery("");
  }

  return (
    <div>
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Receive Stock
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Record products that just arrived.
        </p>
      </div>

      {done ? (
        <Card className="p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 aria-hidden className="h-6 w-6 text-emerald-600" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-zinc-900">
            Stock received successfully.
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {done.added} × {done.name} — now {done.newStock} in stock.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setDone(null)}>Receive More</Button>
          </div>
        </Card>
      ) : (
        <div className="mx-auto max-w-lg">
          <Card className="p-4 sm:p-5">
            <label htmlFor="recv-search" className="text-sm font-medium text-zinc-700">
              Product
            </label>
            <div className="relative mt-1.5">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              />
              <input
                id="recv-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-lg border border-zinc-300 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {matches.length === 0 ? (
              <p className="mt-3 text-center text-sm text-zinc-500">
                No products found. Ask the owner to add the product first.
              </p>
            ) : (
              <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedId(p.id);
                        setQty(1);
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        pickedId === p.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-zinc-200 bg-surface hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-900">
                          {p.name}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          Current stock: {p.stock}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {picked ? (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                <p className="text-sm font-semibold text-zinc-900">{picked.name}</p>
                <p className="text-xs text-zinc-500">Current stock: {picked.stock}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
                    >
                      <Minus aria-hidden className="h-4 w-4" />
                    </button>
                    <span aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums">
                      +{qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty((q) => q + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
                    >
                      <Plus aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                  <Button onClick={() => void confirm()} disabled={busy}>
                    {busy ? "Recording…" : "Confirm"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
