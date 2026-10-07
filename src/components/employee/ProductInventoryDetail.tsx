"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  History,
  PackagePlus,
  PackageX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProducts } from "@/lib/products-store";
import { useSetup } from "@/lib/setup-store";
import { useBusiness } from "@/lib/business-store";
import { useEmployeeSession, currentEmployeeName } from "@/lib/employee-session";
import { hasLegacyCapability as hasCapability } from "@/lib/domain/permissions";
import {
  stockStatus,
  stockStatusLabel,
  lowStockThreshold,
} from "@/lib/domain/stock-state";
import {
  processStockAdjusted,
  ADJUSTMENT_REASONS,
  type AdjustmentReason,
} from "@/lib/domain/automation";
import {
  useStockMovements,
  type StockMovement,
} from "@/lib/domain/stock-movements";
import {
  productCode,
  productCategory,
  productBrand,
  productCostPrice,
} from "@/lib/product-meta";
import { formatMoney, formatMoneyWhole } from "@/lib/currency-symbol";
import { StockStatusPill } from "./StockStatusPill";
import { cn } from "@/lib/utils";

/**
 * Product inventory detail (Phase 5) — one product's stock story: current
 * state, its low-stock level, and the stock activity answering "what happened
 * to this stock, who did it, when, and why". Adjustments go through the
 * automation engine (processStockAdjusted) — never a direct stock write.
 */

export function ProductInventoryDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const { products, status: productsStatus } = useProducts();
  const { setup } = useSetup();
  const { business } = useBusiness();
  const session = useEmployeeSession();
  const [adjustOpen, setAdjustOpen] = useState(false);

  const product = products.find((p) => p.id === productId) ?? null;
  const movements = useStockMovements().filter((m) => m.productId === productId);

  const role = session.activeRole;
  const canAdjust = hasCapability(role, "canAdjustStock");
  const canReceive = hasCapability(role, "canReceiveStock");
  const canSeeCosts = hasCapability(role, "canViewCostPrices");

  // Group movements by day: Today / Yesterday / a date (spec §9 example).
  const groups = useMemo(() => {
    const out: { label: string; items: StockMovement[] }[] = [];
    for (const m of movements.slice(0, 40)) {
      const label = dayLabel(m.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [movements]);

  if (productsStatus === "loading") {
    return (
      <div className="mx-auto max-w-3xl" aria-hidden>
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-100" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-zinc-50" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-zinc-50" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <PackageX aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
        <p className="mt-3 text-sm font-medium text-zinc-900">Product not found</p>
        <p className="mt-1 text-sm text-zinc-500">
          It may have been removed from the catalog.
        </p>
        <Button className="mt-5" onClick={() => router.push("/dashboard/employee/inventory")}>
          Back to Inventory
        </Button>
      </div>
    );
  }

  const status = stockStatus(product);
  const threshold = lowStockThreshold(product);
  const extras = setup.productExtras[product.name];
  const cost = productCostPrice(product.name);
  const warranty =
    extras?.warranty?.available && extras.warranty.period
      ? `${extras.warranty.period}${extras.warranty.notes ? ` — ${extras.warranty.notes}` : ""}`
      : null;

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link
        href="/dashboard/employee/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        Inventory
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            {product.name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {[productCode(product.name), productBrand(product.name), productCategory(product.name)]
              .filter((part) => part && part !== "—")
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canReceive ? (
            <Button
              variant="secondary"
              onClick={() =>
                router.push(`/dashboard/employee/receive-stock?product=${product.id}`)
              }
            >
              <PackagePlus aria-hidden className="h-4 w-4" />
              Receive
            </Button>
          ) : null}
          {canAdjust ? (
            <Button onClick={() => setAdjustOpen(true)}>Adjust Stock</Button>
          ) : null}
        </div>
      </div>

      {/* Product information */}
      <Card className="mt-4 p-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Product Code / Model" value={productCode(product.name)} />
          <Info label="Category" value={productCategory(product.name) || "—"} />
          <Info label="Brand" value={productBrand(product.name) || "—"} />
          <Info
            label="Selling Price"
            value={formatMoney(product.price, business.currency || "NGN")}
          />
          {canSeeCosts ? (
            <Info
              label="Cost Price"
              value={
                cost !== null
                  ? formatMoney(cost, business.currency || "NGN")
                  : "Not set"
              }
            />
          ) : null}
          {canSeeCosts && cost !== null ? (
            <Info
              label="Stock Value (at cost)"
              value={formatMoneyWhole(cost * product.stock, business.currency || "NGN")}
            />
          ) : null}
          <Info label="Low Stock Alert" value={`At ${threshold} units`} />
          <Info label="Warranty" value={warranty ?? "—"} />
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Current Stock
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900">
              {product.stock}
              <span className="ml-1 text-sm font-normal text-zinc-400">units</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Status</p>
            <div className="mt-1 flex justify-end">
              <StockStatusPill status={status} label={stockStatusLabel[status]} />
            </div>
            {status === "out" ? (
              <p className="mt-1 text-xs text-red-600">Restock before selling more.</p>
            ) : status === "low" ? (
              <p className="mt-1 text-xs text-amber-700">
                Only {product.stock} left — at or below {threshold}.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Stock activity — the movement ledger for this product */}
      <Card className="mt-4">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5">
          <History aria-hidden className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Stock Activity</h2>
        </div>
        {groups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <History aria-hidden className="mx-auto h-6 w-6 text-zinc-300" />
            <p className="mt-2 text-sm font-medium text-zinc-900">No stock activity yet</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Sales, receiving, and adjustments for this product will show here.
            </p>
          </div>
        ) : (
          <div className="px-5 py-2">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {g.label}
                </p>
                <ol>
                  {g.items.map((m) => (
                    <MovementRow key={m.id} movement={m} />
                  ))}
                </ol>
              </div>
            ))}
            {movements.length > 40 ? (
              <p className="py-2 text-xs text-zinc-400">
                Showing the 40 most recent movements.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      {adjustOpen ? (
        <AdjustStockDialog product={product} onClose={() => setAdjustOpen(false)} />
      ) : null}
    </div>
  );
}

/* ---------------- Movement row ---------------- */

function MovementRow({ movement: m }: { movement: StockMovement }) {
  const time = new Date(m.at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const action =
    m.kind === "sale"
      ? `sold ${Math.abs(m.quantity)} unit${Math.abs(m.quantity) === 1 ? "" : "s"}`
      : m.kind === "receive"
        ? `received ${m.quantity} unit${m.quantity === 1 ? "" : "s"}`
        : `adjusted stock by ${m.quantity > 0 ? "+" : ""}${m.quantity}`;

  return (
    <li className="flex items-start gap-3 border-b border-zinc-50 py-3 last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          m.kind === "sale" && "bg-red-50 text-red-600",
          m.kind === "receive" && "bg-emerald-50 text-emerald-600",
          m.kind === "adjust" && "bg-amber-50 text-amber-600",
        )}
      >
        {m.kind === "sale" ? (
          <ArrowDownRight className="h-4 w-4" />
        ) : m.kind === "receive" ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowLeftRight className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">{m.actor}</span> {action}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {time}
          {m.kind === "adjust" && m.reason ? ` · ${m.reason}` : ""}
          {m.reference ? ` · ${m.kind === "sale" ? "Ref" : m.kind === "adjust" ? "" : "Received"} ${m.reference}`.trimEnd() : ""}
        </p>
        {m.note ? <p className="mt-0.5 text-xs italic text-zinc-500">“{m.note}”</p> : null}
      </div>
      <p className="shrink-0 text-sm tabular-nums text-zinc-600">
        {m.stockBefore} <span className="text-zinc-300">→</span> {m.stockAfter}
      </p>
    </li>
  );
}

/* ---------------- Adjust Stock dialog ---------------- */

function AdjustStockDialog({
  product,
  onClose,
}: {
  product: { id: string; name: string; stock: number };
  onClose: () => void;
}) {
  const { products, updateProduct } = useProducts();
  const [deltaText, setDeltaText] = useState("");
  const [reason, setReason] = useState<AdjustmentReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ from: number; to: number } | null>(null);

  const parsed = Number.parseInt(deltaText, 10);
  const delta = Number.isInteger(parsed) ? parsed : null;
  const projected = delta !== null ? product.stock + delta : null;

  async function submit() {
    setError(null);
    if (reason === "") {
      setError("Choose a reason for this adjustment.");
      return;
    }
    if (delta === null || delta === 0) {
      setError("Enter the adjustment quantity (not zero).");
      return;
    }
    // Fresh snapshot at submit time — stock may have changed since opening.
    const current = products.find((p) => p.id === product.id);
    if (!current) {
      setError("This product is no longer in the catalog.");
      return;
    }
    setBusy(true);
    const result = await processStockAdjusted({
      product: current,
      delta,
      reason,
      note: note.trim() || undefined,
      actor: { name: currentEmployeeName(), operationalRole: "employee" },
      // Repository adapter: the engine decides the new stock; this persists it.
      applyStockChange: async (productId, newStock) => {
        const p = products.find((x) => x.id === productId);
        if (!p) return;
        await updateProduct(productId, {
          name: p.name,
          price: p.price,
          stock: newStock,
          imageUrl: p.imageUrl,
        });
      },
    });
    setBusy(false);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    setDone({ from: current.stock, to: result.newStock });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust stock"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl">
        {done ? (
          <div className="py-6 text-center">
            <p className="text-lg font-semibold text-zinc-900">Stock adjusted.</p>
            <p className="mt-1 text-sm text-zinc-500">
              {done.from} → {done.to} in stock.
            </p>
            <Button className="mt-5 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Adjust Stock</h2>
                <p className="mt-0.5 text-sm text-zinc-500">{product.name}</p>
              </div>
              <p className="shrink-0 text-right text-xs text-zinc-400">
                Current stock
                <span className="block text-lg font-semibold tabular-nums text-zinc-900">
                  {product.stock}
                </span>
              </p>
            </div>

            <label htmlFor="adj-qty" className="mt-4 block text-sm font-medium text-zinc-700">
              Quantity{" "}
              <span className="font-normal text-zinc-400">
                (negative to reduce, positive to add back)
              </span>
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease adjustment quantity"
                onClick={() => setDeltaText(String((delta ?? 0) - 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-lg text-zinc-700 hover:bg-zinc-50"
              >
                −
              </button>
              <input
                id="adj-qty"
                type="number"
                inputMode="numeric"
                value={deltaText}
                onChange={(e) => setDeltaText(e.target.value)}
                placeholder="e.g. -2"
                className="w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                aria-label="Increase adjustment quantity"
                onClick={() => setDeltaText(String((delta ?? 0) + 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-lg text-zinc-700 hover:bg-zinc-50"
              >
                +
              </button>
            </div>
            {projected !== null && delta !== 0 ? (
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  projected < 0 ? "text-red-600" : "text-zinc-500",
                )}
              >
                New stock: {projected}
                {projected < 0 ? " — stock cannot go below zero." : ""}
              </p>
            ) : null}

            <label htmlFor="adj-reason" className="mt-4 block text-sm font-medium text-zinc-700">
              Reason <span aria-hidden className="text-red-500">*</span>
            </label>
            <select
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustmentReason)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Choose a reason…</option>
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label htmlFor="adj-note" className="mt-4 block text-sm font-medium text-zinc-700">
              Note <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Two units damaged during delivery."
              className="mt-1.5 w-full resize-none rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />

            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void submit()} disabled={busy}>
                {busy ? "Adjusting…" : "Apply Adjustment"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

/** "Today" / "Yesterday" / "Mon, Sep 21" for grouping the activity feed. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
