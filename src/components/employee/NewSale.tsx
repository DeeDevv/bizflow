"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Minus,
  PackageSearch,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  UserRoundPlus,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useProducts } from "@/lib/products-store";
import { productCode, productCategory, productBrand } from "@/lib/product-meta";
import { useCustomers } from "@/lib/customers-store";
import { currentEmployeeName } from "@/lib/employee-session";
import { recordActivity } from "@/lib/activity-store";
import { stockStatus } from "@/lib/domain/stock-state";
import { processSaleCompleted } from "@/lib/domain/automation";
import { buildReceiptData } from "@/lib/domain/receipt";
import {
  addItemToSale,
  formatSaleMoney,
  removeSaleItem,
  saleBalance,
  saleDiscountAmount,
  saleSubtotal,
  saleTotal,
  setSaleItemQuantity,
  updateSaleDraft,
  useSaleDraft,
  type CompletedSale,
  type PaymentStatus,
} from "@/lib/employee-sales";
import { cn } from "@/lib/utils";

/**
 * Phase 3 — the New Sale workspace.
 *
 * One compact transaction screen: find products (search by name, code,
 * brand, category) → adjust quantities → pick the customer (existing, new,
 * or walk-in) → choose payment → review inline → Complete Sale. The current
 * sale is always visible; nothing is re-typed from the catalog.
 */

/* ---------------- Product picker ---------------- */

function ProductPicker() {
  const { products } = useProducts();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [picked, setPicked] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const cat = productCategory(p.name);
      if (cat) set.add(cat);
    }
    return ["All", ...set];
  }, [products]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "All" && productCategory(p.name) !== category) return false;
      if (!q) return true;
      const hay = [
        p.name,
        productCode(p.name),
        productBrand(p.name),
        productCategory(p.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, category]);

  const pickedProduct = products.find((p) => p.id === picked) ?? null;

  function tryAdd() {
    if (!pickedProduct) return;
    const result = addItemToSale(
      {
        id: pickedProduct.id,
        name: pickedProduct.name,
        code: productCode(pickedProduct.name),
        category: productCategory(pickedProduct.name),
        price: pickedProduct.price,
        stock: pickedProduct.stock,
      },
      qty,
    );
    if (result.ok) {
      setPicked(null);
      setQty(1);
      setNote(null);
    } else {
      setNote(result.message ?? "Could not add this product.");
    }
  }

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <label htmlFor="sale-search" className="text-sm font-medium text-zinc-700">
        Find a product
      </label>
      <div className="relative mt-1.5">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          id="sale-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, code/model, brand…"
          className="w-full rounded-lg border border-zinc-300 bg-surface py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      {categories.length > 1 ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "bg-brand-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {/* Results / empty states */}
      {products.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
          <PackageSearch aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">No products yet</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Products added during setup appear here.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
          <PackageSearch aria-hidden className="mx-auto h-6 w-6 text-zinc-300" />
          <p className="mt-2 text-sm font-medium text-zinc-900">Product not found</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            No product matches &ldquo;{query.trim()}&rdquo;.
          </p>
          <Button size="sm" variant="secondary" className="mt-3">
            Request New Product
          </Button>
        </div>
      ) : (
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
          {results.map((p) => {
            const status = stockStatus(p);
            const disabled = status === "out";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setPicked(p.id);
                    setQty(1);
                    setNote(null);
                  }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                    picked === p.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-zinc-200 bg-surface hover:bg-zinc-50",
                    disabled && "opacity-60",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {[productCode(p.name), productCategory(p.name)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums text-zinc-900">
                        {formatSaleMoney(p.price)}
                      </span>
                      <span
                        className={cn(
                          "block text-xs font-medium",
                          status === "out" && "text-red-600",
                          status === "low" && "text-amber-600",
                          status === "in" && "text-emerald-600",
                        )}
                      >
                        {status === "out"
                          ? "Out of stock"
                          : `Stock: ${p.stock}`}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Quantity selector for the picked product */}
      {pickedProduct ? (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
          <p className="text-sm font-semibold text-zinc-900">{pickedProduct.name}</p>
          <p className="text-xs text-zinc-500">
            {productCode(pickedProduct.name)} · {formatSaleMoney(pickedProduct.price)} ·
            Available: {pickedProduct.stock}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
              >
                <Minus aria-hidden className="h-4 w-4" />
              </button>
              <span aria-live="polite" className="w-8 text-center text-sm font-semibold tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(pickedProduct.stock, q + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
              >
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={tryAdd}>Add to Sale</Button>
          </div>
          {note ? (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ---------------- Customer section ---------------- */

type CustomerMode = "pick" | "new" | "walkin" | null;

function CustomerSection() {
  const draft = useSaleDraft();
  const { customers, addCustomer } = useCustomers();
  const [mode, setMode] = useState<CustomerMode>(null);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customers, query]);

  async function saveNewCustomer() {
    if (!newName.trim()) {
      setError("Please enter the customer's name.");
      return;
    }
    setBusy(true);
    setError(null);
    const saved = await addCustomer({ name: newName.trim(), email: "", phone: newPhone.trim() });
    setBusy(false);
    if (!saved) {
      setError("Could not save the customer. Please try again.");
      return;
    }
    recordActivity({
      kind: "customer_added",
      actor: currentEmployeeName(),
      label: `added customer ${saved.name}`,
      customerId: saved.id,
    });
    updateSaleDraft({ customerId: saved.id, customerName: saved.name, customerPhone: saved.phone });
    setMode(null);
    setNewName("");
    setNewPhone("");
    setQuery("");
  }

  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">Customer</p>

      {draft.customerId === null && draft.customerName === "" ? (
        mode === null ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMode("pick")} className="gap-1.5">
              <UserRoundSearch aria-hidden className="h-4 w-4" />
              Existing
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMode("new")} className="gap-1.5">
              <UserRoundPlus aria-hidden className="h-4 w-4" />
              New
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateSaleDraft({ customerId: null, customerName: "Walk-in Customer", customerPhone: "" })}
              className="gap-1.5"
            >
              <Users aria-hidden className="h-4 w-4" />
              Walk-in
            </Button>
          </div>
        ) : mode === "pick" ? (
          <div className="mt-2 rounded-xl border border-zinc-200 p-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or phone…"
              aria-label="Search customers"
              className="w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {matches.length === 0 ? (
              <div className="mt-2 text-center">
                <p className="text-sm text-zinc-500">Customer not found.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setMode("new");
                    setNewName(query.trim());
                  }}
                >
                  Add New Customer
                </Button>
              </div>
            ) : (
              <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        updateSaleDraft({ customerId: c.id, customerName: c.name, customerPhone: c.phone });
                        setMode(null);
                        setQuery("");
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      <span className="block font-medium text-zinc-900">{c.name}</span>
                      {c.phone ? (
                        <span className="block text-xs text-zinc-500">{c.phone}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setMode(null)}
              className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-zinc-200 p-3">
            <label htmlFor="new-cust-name" className="text-xs font-medium text-zinc-600">
              Name <span aria-hidden className="text-red-500">*</span>
            </label>
            <input
              id="new-cust-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <label htmlFor="new-cust-phone" className="mt-2 block text-xs font-medium text-zinc-600">
              Phone
            </label>
            <input
              id="new-cust-phone"
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {error ? (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
              <Button size="sm" onClick={() => void saveNewCustomer()} disabled={busy}>
                {busy ? "Saving…" : "Save Customer"}
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{draft.customerName}</p>
            {draft.customerPhone ? (
              <p className="truncate text-xs text-zinc-500">{draft.customerPhone}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Change customer"
            onClick={() => updateSaleDraft({ customerId: null, customerName: "", customerPhone: "" })}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Payment section ---------------- */

function PaymentSection() {
  const draft = useSaleDraft();
  const total = saleTotal(draft);

  const statuses: Array<{ value: PaymentStatus; label: string }> = [
    { value: "paid", label: "Paid" },
    { value: "part", label: "Part-paid" },
    { value: "unpaid", label: "Unpaid" },
  ];

  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">Payment</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={draft.paymentStatus === s.value}
            onClick={() =>
              updateSaleDraft({
                paymentStatus: s.value,
                amountPaid: s.value === "paid" ? total : 0,
              })
            }
            className={cn(
              "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
              draft.paymentStatus === s.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Payment method — only when money is changing hands now */}
      {draft.paymentStatus !== "unpaid" ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-600">Method</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(["cash", "transfer", "pos", "other"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={draft.method === m}
                onClick={() => updateSaleDraft({ method: m })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                  draft.method === m
                    ? "bg-brand-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                )}
              >
                {m === "pos" ? "POS" : m === "transfer" ? "Bank Transfer" : m}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft.paymentStatus === "part" ? (
        <div className="mt-3">
          <label htmlFor="amount-paid" className="text-xs font-medium text-zinc-600">
            Amount paid
          </label>
          <input
            id="amount-paid"
            type="number"
            min={0}
            step="0.01"
            value={draft.amountPaid || ""}
            onChange={(e) => updateSaleDraft({ amountPaid: Math.max(0, Number.parseFloat(e.target.value) || 0) })}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total</span>
              <span className="font-medium tabular-nums">{formatSaleMoney(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Paid</span>
              <span className="font-medium tabular-nums">{formatSaleMoney(draft.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1">
              <span className="font-medium text-zinc-700">Balance</span>
              <span className="font-semibold tabular-nums text-amber-700">
                {formatSaleMoney(saleBalance(draft))}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Current sale panel ---------------- */

function CurrentSalePanel({ onComplete }: { onComplete: (sale: CompletedSale) => void }) {
  const draft = useSaleDraft();
  const { products, updateProduct } = useProducts();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  /**
   * Repository adapter for the automation engine: persists one product's
   * new stock via the existing optimistic store (local today, database
   * update in the backend phase — the engine logic never changes).
   */
  function applyDeductedStock(productId: string, newStock: number): void {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    void updateProduct(productId, {
      name: product.name,
      price: product.price,
      stock: newStock,
      imageUrl: product.imageUrl,
    });
  }

  async function handleComplete() {
    setBusy(true);
    setError(null);
    // Let React paint the busy state before processing.
    await Promise.resolve();
    // ONE automation path (Phase 4): validation, inventory, transaction,
    // customer history, metrics, activity, threshold checks, receipt data —
    // all inside processSaleCompleted. The UI only reports the outcome.
    const result = await processSaleCompleted({
      draft,
      catalog: products,
      actor: currentEmployeeName(),
      applyStockChange: applyDeductedStock,
    });
    setBusy(false);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    onComplete(result.sale);
  }

  const subtotal = saleSubtotal(draft);
  const discount = saleDiscountAmount(draft);
  const total = saleTotal(draft);

  return (
    <Card className="flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Current Sale</h2>
        {draft.items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear this sale and start over?")) {
                updateSaleDraft({ items: [], discountPercent: null });
              }
            }}
            className="text-xs font-medium text-zinc-400 hover:text-red-600"
          >
            Clear
          </button>
        ) : null}
      </div>

      {draft.items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
          <ShoppingBasket aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">Empty sale</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Search for a product to start selling.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {draft.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                <p className="text-xs tabular-nums text-zinc-500">
                  {formatSaleMoney(item.unitPrice)} each
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${item.name}`}
                  onClick={() => setSaleItemQuantity(item.productId, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
                >
                  <Minus aria-hidden className="h-3.5 w-3.5" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${item.name}`}
                  onClick={() => setSaleItemQuantity(item.productId, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-surface text-zinc-700 hover:bg-zinc-50"
                >
                  <Plus aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
                {formatSaleMoney(item.unitPrice * item.quantity)}
              </p>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => removeSaleItem(item.productId)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Discount (existing BizMate concept, kept small) */}
      {draft.items.length > 0 ? (
        <div className="mt-2">
          {draft.discountPercent ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
              <span className="font-medium text-amber-700">Discount {draft.discountPercent}%</span>
              <span className="flex items-center gap-2 tabular-nums text-amber-700">
                −{formatSaleMoney(discount)}
                <button
                  type="button"
                  aria-label="Remove discount"
                  onClick={() => updateSaleDraft({ discountPercent: null })}
                  className="rounded p-0.5 hover:bg-amber-100"
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ) : discountOpen ? (
            <div className="rounded-lg border border-zinc-200 p-2.5">
              <label htmlFor="sale-discount" className="text-xs font-medium text-zinc-600">
                Discount %
              </label>
              <input
                id="sale-discount"
                type="number"
                min={0}
                max={100}
                value={draft.discountPercent ?? ""}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0));
                  updateSaleDraft({ discountPercent: v || null });
                }}
                placeholder="e.g. 5"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                onClick={() => setDiscountOpen(false)}
                className="mt-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Add discount
            </button>
          )}
        </div>
      ) : null}

      {/* Totals */}
      {draft.items.length > 0 ? (
        <dl className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="tabular-nums">{formatSaleMoney(subtotal)}</dd>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-zinc-500">Discount</dt>
              <dd className="tabular-nums text-amber-700">−{formatSaleMoney(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-zinc-100 pt-1.5">
            <dt className="font-semibold text-zinc-900">Total</dt>
            <dd className="text-base font-semibold tabular-nums">{formatSaleMoney(total)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 space-y-4">
        <CustomerSection />
        {draft.items.length > 0 ? <PaymentSection /> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        <Button
          className="w-full"
          disabled={draft.items.length === 0 || busy}
          onClick={() => void handleComplete()}
        >
          {busy ? "Completing sale…" : "Complete Sale"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Success screen ---------------- */

function SaleSuccess({
  sale,
  onNewSale,
}: {
  sale: CompletedSale;
  onNewSale: () => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6 text-center sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 aria-hidden className="h-7 w-7 text-emerald-600" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          Sale Completed
        </h1>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">
          {formatSaleMoney(sale.total)}
        </p>

        <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-left text-sm">
          <ul className="space-y-1">
            {sale.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-zinc-700">
                  {i.name} × {i.quantity}
                </span>
                <span className="tabular-nums text-zinc-900">
                  {formatSaleMoney(i.unitPrice * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-zinc-200 pt-2 text-xs text-zinc-500">
            <p>Customer: {sale.customerName}</p>
            <p className="capitalize">
              Payment:{" "}
              {sale.paymentStatus === "part" ? "Part-paid" : sale.paymentStatus}
            </p>
            {sale.paymentStatus === "part" ? (
              <p>
                Paid {formatSaleMoney(sale.amountPaid)} · Balance{" "}
                {formatSaleMoney(sale.balance)}
              </p>
            ) : null}
            <p>Ref: {sale.reference}</p>
          </div>
        </div>

        <SaleReceipt sale={sale} />

        <div className="mt-5 grid gap-2">
          <Button onClick={onNewSale}>New Sale</Button>
          <Button variant="secondary" onClick={onNewSale}>
            Back to Transactions
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Receipt (inline preview) ---------------- */

function SaleReceipt({ sale }: { sale: CompletedSale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide Receipt" : "View Receipt"}
      </Button>
      {open ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm">
          <ReceiptBody sale={sale} />
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptBody({ sale }: { sale: CompletedSale }) {
  return (
    <div>
      <p className="text-center text-base font-semibold text-zinc-900">Receipt</p>
      <ReceiptDetails sale={sale} />
    </div>
  );
}

/**
 * Renders the structured ReceiptData produced by the automation engine
 * (buildReceiptData) — the single receipt calculation source (spec §12).
 */
export function ReceiptDetails({ sale }: { sale: CompletedSale }) {
  const data = buildReceiptData(sale);
  return (
    <div className="text-sm">
      {/* Business header */}
      <div className="border-b border-dashed border-zinc-200 pb-2 text-center">
        <p className="text-base font-semibold text-zinc-900">{data.business.name}</p>
        {data.business.phone ? (
          <p className="text-xs text-zinc-500">{data.business.phone}</p>
        ) : null}
      </div>

      {/* Transaction + customer meta */}
      <div className="space-y-0.5 border-b border-dashed border-zinc-200 py-2 text-xs text-zinc-500">
        <p>Ref: {data.transaction.reference}</p>
        <p>Date: {new Date(data.transaction.dateTime).toLocaleString("en-US")}</p>
        <p>Served by: {data.transaction.employeeName}</p>
        <p>Customer: {data.customer.name}</p>
        {data.customer.phone ? <p>Phone: {data.customer.phone}</p> : null}
        {data.payment.methodLabel ? <p>Method: {data.payment.methodLabel}</p> : null}
      </div>

      {/* Items */}
      <ul className="space-y-1 border-b border-dashed border-zinc-200 py-2">
        {data.items.map((i) => (
          <li key={i.name} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium text-zinc-900">{i.name}</span>
              <span className="block text-xs tabular-nums text-zinc-500">
                {i.quantity} × {formatSaleMoney(i.unitPrice)}
              </span>
            </span>
            <span className="tabular-nums">{formatSaleMoney(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {/* Totals — straight from the structured data */}
      <div className="space-y-1 pt-2">
        <div className="flex justify-between text-zinc-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatSaleMoney(data.subtotal)}</span>
        </div>
        {data.discountAmount > 0 ? (
          <div className="flex justify-between text-amber-700">
            <span>
              Discount{data.discountPercent ? ` (${data.discountPercent}%)` : ""}
            </span>
            <span className="tabular-nums">−{formatSaleMoney(data.discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold text-zinc-900">
          <span>Total</span>
          <span className="tabular-nums">{formatSaleMoney(data.total)}</span>
        </div>
        <div className="flex justify-between text-zinc-600">
          <span>Payment: {data.payment.statusLabel}</span>
          <span className="tabular-nums">{formatSaleMoney(data.payment.amountPaid)}</span>
        </div>
        {data.payment.balance > 0 ? (
          <div className="flex justify-between font-medium text-amber-700">
            <span>Balance due</span>
            <span className="tabular-nums">{formatSaleMoney(data.payment.balance)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export function NewSale() {
  const [completed, setCompleted] = useState<CompletedSale | null>(null);

  if (completed) {
    return <SaleSuccess sale={completed} onNewSale={() => setCompleted(null)} />;
  }

  return (
    <div className="min-w-0">
      <div className="pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">New Sale</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Find the product, confirm the details, complete the sale.
        </p>
      </div>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ProductPicker />
        <CurrentSalePanel onComplete={setCompleted} />
      </div>
    </div>
  );
}
