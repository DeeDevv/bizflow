"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Minus, PackagePlus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useProducts } from "@/lib/products-store";
import { processStockReceived } from "@/lib/domain/automation";
import { stockStatus, stockStatusLabel } from "@/lib/domain/stock-state";
import { actorFromSession, hasCapability } from "@/lib/domain/permissions";
import { productCode, productBrand } from "@/lib/product-meta";
import {
  currentEmployeeName,
  useEmployeeSession,
} from "@/lib/employee-session";
import { formatMoneyWhole } from "@/lib/currency-symbol";
import { getBusinessInfo } from "@/lib/business-store";
import { StockStatusPill } from "./StockStatusPill";
import { cn } from "@/lib/utils";

/**
 * Receive Stock (Phase 5, extended Phase 8.6 spec §3/§4/§14).
 *
 * Simple input → automatic calculation: the manager enters Product,
 * Quantity, Cost per unit and Selling price; BizMate shows Total Cost,
 * Potential Sales and Potential Profit live, then records them with the
 * batch (spec §6) through the automation engine. Pure employees still get
 * the simple flow — cost/price inputs are only for sessions with the
 * setPricing capability (spec §14: employees see no financial complexity).
 *
 * The employee never edits stock numbers by hand: one automation path
 * (processStockReceived) does the increase, condition re-check, and the
 * movement ledger entry.
 */

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function ReceiveStock() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("product");

  const { products, updateProduct, status: productsStatus } = useProducts();
  const session = useEmployeeSession();
  // Cost/selling inputs belong to whoever sets pricing (spec §3: the
  // MANAGER enters them; pure employees keep the simple quantity flow).
  const canPrice = hasCapability(
    actorFromSession({ activeRole: session.activeRole, name: session.name }),
    "setPricing",
  );

  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(preselectId);
  const [qty, setQty] = useState(1);
  const [costInput, setCostInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; added: number; newStock: number } | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) =>
          [p.name, productCode(p.name), productBrand(p.name)].join(" ").toLowerCase().includes(q),
        )
      : products;
    return list.slice(0, 8);
  }, [products, query]);

  const picked = products.find((p) => p.id === pickedId) ?? null;

  // LIVE AUTO-CALCULATION (spec §3/§4): BizMate does all the math — the
  // numbers update as the manager types, before anything is recorded.
  const costPerUnit = Number(costInput.replace(/[^0-9.]/g, "")) || 0;
  const sellingPrice = Number(priceInput.replace(/[^0-9.]/g, "")) || 0;
  const totalCost = qty * costPerUnit;
  const potentialSales = qty * (sellingPrice || picked?.price || 0);
  const potentialProfit = potentialSales - totalCost;
  const money = (v: number) => formatMoneyWhole(v, getBusinessInfo().currency || "NGN");

  async function confirm() {
    if (!picked || qty <= 0) return;
    setBusy(true);
    setError(null);
    // ONE automation path (Phase 4): increase, activity, movement ledger,
    // and the low/out-of-stock condition re-check all live in the engine.
    // Phase 8.6: the batch carries its own cost + receive-time selling
    // price, so historical cost is preserved (spec §6).
    const result = await processStockReceived({
      product: picked,
      quantity: qty,
      ...(canPrice
        ? { costPerUnit, sellingPrice: sellingPrice || picked.price }
        : {}),
      actor: { name: currentEmployeeName(), operationalRole: "employee" },
      applyStockChange: async (productId, newStock) => {
        // phase 8.6: when this session may set pricing, the selling price
        // entered here becomes the product's current price too.
        await updateProduct(productId, {
          name: picked.name,
          price: canPrice && (sellingPrice > 0 || costPerUnit > 0) ? sellingPrice || picked.price : picked.price,
          stock: newStock,
          imageUrl: picked.imageUrl,
        });
      },
    });
    setBusy(false);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    setDone({ name: picked.name, added: qty, newStock: result.newStock });
    setPickedId(null);
    setQty(1);
    setCostInput("");
    setPriceInput("");
    setQuery("");
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 aria-hidden className="h-6 w-6 text-emerald-600" />
          </span>
          <h1 className="mt-3 text-lg font-semibold text-zinc-900">Stock received.</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {done.added} × {done.name} — now {done.newStock} in stock.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setDone(null)}>Receive More</Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard/employee/inventory")}>
              Back to Inventory
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Receive Stock</h1>
        <p className="mt-1 text-sm text-zinc-500">Record products that just arrived.</p>
      </div>

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
              placeholder="Search name, code, brand…"
              className="w-full rounded-lg border border-zinc-300 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {productsStatus === "loading" ? (
            <div className="mt-3 space-y-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-50" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <p className="mt-3 text-center text-sm text-zinc-500">
              {products.length === 0
                ? "No products yet. Products added during setup appear here."
                : "No product matches. New products are added by the owner in Products."}
            </p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {matches.map((p) => {
                const status = stockStatus(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickedId(p.id);
                        setQty(1);
                        setError(null);
                      }}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                        pickedId === p.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-zinc-200 bg-surface hover:bg-zinc-50",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-zinc-900">
                            {p.name}
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {productCode(p.name)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-medium tabular-nums text-zinc-900">
                            {p.stock}
                          </span>
                          <StockStatusPill status={status} label={stockStatusLabel[status]} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {picked ? (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{picked.name}</p>
                  <p className="text-xs text-zinc-500">Current stock: {picked.stock}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickedId(null);
                    setQuery("");
                  }}
                  className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-700"
                >
                  Change
                </button>
              </div>
              {qty > 0 ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  After receiving: {picked.stock} → {picked.stock + qty}
                </p>
              ) : null}

              {/* Phase 8.6 (spec §3): cost + selling price — manager enters
                  only these; every total below is calculated for them. */}
              {canPrice ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700">Cost per unit</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={costInput}
                      onChange={(e) => setCostInput(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                      className={cn(inputCls, "mt-1")}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700">Selling price</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder={String(picked.price)}
                      className={cn(inputCls, "mt-1")}
                    />
                  </label>
                </div>
              ) : null}

              {/* Auto-calculated preview (spec §3/§4 — total cost, potential
                  sales, potential profit; clearly labeled as POTENTIAL). */}
              {canPrice && costPerUnit > 0 ? (
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-zinc-200 bg-surface px-3 py-2.5 text-center">
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500">Total Cost</dt>
                    <dd className="text-sm font-semibold tabular-nums text-zinc-900">
                      {money(totalCost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500">Potential Sales</dt>
                    <dd className="text-sm font-semibold tabular-nums text-zinc-900">
                      {money(potentialSales)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500">Potential Profit</dt>
                    <dd
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        potentialProfit >= 0 ? "text-emerald-700" : "text-red-700",
                      )}
                    >
                      {money(potentialProfit)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
                  >
                    <Minus aria-hidden className="h-4 w-4" />
                  </button>
                  <span
                    aria-live="polite"
                    className="w-10 text-center text-sm font-semibold tabular-nums"
                  >
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

          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </Card>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-400">
          <PackagePlus aria-hidden className="h-3.5 w-3.5" />
          BizMate updates the stock automatically — you never edit the count by hand.
        </p>
      </div>
    </div>
  );
}
