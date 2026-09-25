"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { categoryDetailFields, PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { formatMoney } from "@/lib/currency-symbol";
import { useSetup, type SetupProduct } from "@/lib/setup-store";
import { StepError, field } from "./shared";

/**
 * Step 4 — Products. A short, essential-only form: name, code/model,
 * category, brand, selling price, optional cost price (with a live profit
 * preview), opening stock, and an optional low-stock alert level. Warranty
 * and category-specific details stay behind a "More details" disclosure so
 * the main form never feels huge.
 */

interface ProductDraft {
  name: string;
  code: string;
  category: string;
  brand: string;
  sellingPrice: string;
  costPrice: string;
  openingStock: string;
  lowStockAt: string;
  warrantyAvailable: boolean;
  warrantyPeriod: string;
  warrantyNotes: string;
  details: Record<string, string>;
}

function emptyDraft(): ProductDraft {
  return {
    name: "",
    code: "",
    category: "",
    brand: "",
    sellingPrice: "",
    costPrice: "",
    openingStock: "",
    lowStockAt: "",
    warrantyAvailable: false,
    warrantyPeriod: "",
    warrantyNotes: "",
    details: {},
  };
}

export function ProductStep({
  onBack,
  onNext,
  onSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { setup, addProduct, updateProduct, removeProduct } = useSetup();
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = setup.businessDraft.currency || "NGN";
  const detailFields = categoryDetailFields(draft.category);

  const selling = Number.parseFloat(draft.sellingPrice);
  const cost =
    draft.costPrice.trim() === "" ? null : Number.parseFloat(draft.costPrice);
  const profit =
    cost !== null && Number.isFinite(selling) && Number.isFinite(cost)
      ? selling - cost
      : null;

  function openAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setShowForm(true);
    setShowMore(false);
    setError(null);
  }

  function openEdit(p: SetupProduct) {
    setDraft({
      name: p.name,
      code: p.code,
      category: p.category,
      brand: p.brand,
      sellingPrice: String(p.sellingPrice),
      costPrice: p.costPrice === null ? "" : String(p.costPrice),
      openingStock: String(p.openingStock),
      lowStockAt: p.lowStockAt ? String(p.lowStockAt) : "",
      warrantyAvailable: p.warranty.available,
      warrantyPeriod: p.warranty.period,
      warrantyNotes: p.warranty.notes,
      details: { ...p.details },
    });
    setEditingId(p.id);
    setShowForm(true);
    setShowMore(p.warranty.available || Object.keys(p.details).length > 0);
    setError(null);
  }

  function closeForm() {
    setDraft(emptyDraft());
    setEditingId(null);
    setShowForm(false);
    setShowMore(false);
    setError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    const code = draft.code.trim();
    const category = draft.category.trim();
    const parsedSelling = Number.parseFloat(draft.sellingPrice);
    const parsedStock = Number.parseInt(draft.openingStock, 10);

    if (!name) {
      setError("Please enter a product name.");
      return;
    }
    if (!code) {
      setError("Please enter the product code / model.");
      return;
    }
    if (!category) {
      setError("Please choose or type a category.");
      return;
    }
    if (!Number.isFinite(parsedSelling) || parsedSelling < 0) {
      setError("Please enter a valid selling price.");
      return;
    }
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setError("Please enter the opening stock (0 or more).");
      return;
    }
    const parsedCost =
      draft.costPrice.trim() === "" ? null : Number.parseFloat(draft.costPrice);
    if (
      parsedCost !== null &&
      (!Number.isFinite(parsedCost) || parsedCost < 0)
    ) {
      setError("Please enter a valid cost price.");
      return;
    }
    const parsedLow =
      draft.lowStockAt.trim() === "" ? 0 : Number.parseInt(draft.lowStockAt, 10);
    if (!Number.isInteger(parsedLow) || parsedLow < 0) {
      setError("Please enter a valid low-stock level (0 or more).");
      return;
    }

    const product: Omit<SetupProduct, "id"> = {
      name,
      code,
      category,
      brand: draft.brand.trim(),
      sellingPrice: Math.round(parsedSelling * 100) / 100,
      costPrice: parsedCost === null ? null : Math.round(parsedCost * 100) / 100,
      openingStock: parsedStock,
      lowStockAt: parsedLow,
      warranty: {
        available: draft.warrantyAvailable,
        period: draft.warrantyPeriod.trim(),
        notes: draft.warrantyNotes.trim(),
      },
      details: draft.details,
      imageUrl: "",
    };

    if (editingId) {
      updateProduct(editingId, product);
    } else {
      addProduct(product);
    }
    closeForm();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Add the products you sell
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        BizMate tracks stock and reuses these products on every sale. Add a few
        now — the rest can wait until later.
      </p>

      {/* Product list */}
      {setup.products.length > 0 ? (
        <ul className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {setup.products.map((p) => {
            const low = p.lowStockAt > 0 && p.openingStock <= p.lowStockAt;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <PackagePlus aria-hidden className="h-4 w-4 text-brand-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {[p.code, p.category].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums text-zinc-900">
                    {formatMoney(p.sellingPrice, currency)}
                  </p>
                  <p
                    className={
                      low ? "text-xs font-medium text-amber-600" : "text-xs text-zinc-500"
                    }
                  >
                    Stock: {p.openingStock}
                    {low ? " · Low" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  aria-label={`Edit ${p.name}`}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  aria-label={`Remove ${p.name}`}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : !showForm ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
          <PackagePlus aria-hidden className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-900">No products yet</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Add the products your business sells so BizMate can track them.
          </p>
          <div className="mt-4">
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus aria-hidden className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>
      ) : null}

      {/* Add / edit form */}
      {showForm ? (
        <form
          onSubmit={handleSave}
          noValidate
          className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prd-name" className="text-sm font-medium text-zinc-700">
                Product name <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="prd-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Hisense 1HP Inverter AC"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="prd-code" className="text-sm font-medium text-zinc-700">
                Product code / model <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="prd-code"
                type="text"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="e.g. AS12TG1"
                className={field}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prd-category" className="text-sm font-medium text-zinc-700">
                Category <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="prd-category"
                type="text"
                list="setup-category-options"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Pick a suggestion or type your own"
                className={field}
              />
              <datalist id="setup-category-options">
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="prd-brand" className="text-sm font-medium text-zinc-700">
                Brand <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="prd-brand"
                type="text"
                value={draft.brand}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                placeholder="e.g. Hisense"
                className={field}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prd-selling" className="text-sm font-medium text-zinc-700">
                Selling price <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="prd-selling"
                type="number"
                min={0}
                step="0.01"
                value={draft.sellingPrice}
                onChange={(e) => setDraft({ ...draft, sellingPrice: e.target.value })}
                placeholder="0.00"
                className={`${field} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="prd-cost" className="text-sm font-medium text-zinc-700">
                Cost price <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="prd-cost"
                type="number"
                min={0}
                step="0.01"
                value={draft.costPrice}
                onChange={(e) => setDraft({ ...draft, costPrice: e.target.value })}
                placeholder="0.00"
                className={`${field} tabular-nums`}
              />
              {profit !== null ? (
                <p
                  className={
                    profit >= 0
                      ? "mt-1.5 text-xs font-medium text-emerald-700"
                      : "mt-1.5 text-xs font-medium text-red-600"
                  }
                >
                  {profit >= 0 ? "Potential profit: " : "Below cost: "}
                  {formatMoney(Math.abs(profit), currency)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prd-stock" className="text-sm font-medium text-zinc-700">
                Opening stock <span aria-hidden className="text-red-500">*</span>
              </label>
              <input
                id="prd-stock"
                type="number"
                min={0}
                step="1"
                value={draft.openingStock}
                onChange={(e) => setDraft({ ...draft, openingStock: e.target.value })}
                placeholder="How many you have now"
                className={`${field} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="prd-low" className="text-sm font-medium text-zinc-700">
                Low stock alert at{" "}
                <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="prd-low"
                type="number"
                min={0}
                step="1"
                value={draft.lowStockAt}
                onChange={(e) => setDraft({ ...draft, lowStockAt: e.target.value })}
                placeholder="e.g. 2"
                className={`${field} tabular-nums`}
              />
            </div>
          </div>

          {/* Category-aware detail fields */}
          {detailFields.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {detailFields.map((f) => (
                <div key={f.key}>
                  <label
                    htmlFor={`prd-detail-${f.key}`}
                    className="text-sm font-medium text-zinc-700"
                  >
                    {f.label} <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id={`prd-detail-${f.key}`}
                    type="text"
                    value={draft.details[f.key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        details: { ...draft.details, [f.key]: e.target.value },
                      })
                    }
                    placeholder={f.placeholder}
                    className={field}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {/* Optional warranty (disclosure) */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {showMore ? (
              <ChevronUp aria-hidden className="h-4 w-4" />
            ) : (
              <ChevronDown aria-hidden className="h-4 w-4" />
            )}
            {showMore ? "Hide warranty fields" : "Warranty (optional)"}
          </button>

          {showMore ? (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-surface p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={draft.warrantyAvailable}
                  onChange={(e) =>
                    setDraft({ ...draft, warrantyAvailable: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500/20"
                />
                Warranty available?
              </label>
              {draft.warrantyAvailable ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="prd-warranty-period"
                      className="text-sm font-medium text-zinc-700"
                    >
                      Warranty period
                    </label>
                    <input
                      id="prd-warranty-period"
                      type="text"
                      value={draft.warrantyPeriod}
                      onChange={(e) =>
                        setDraft({ ...draft, warrantyPeriod: e.target.value })
                      }
                      placeholder="e.g. 1 year"
                      className={field}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="prd-warranty-notes"
                      className="text-sm font-medium text-zinc-700"
                    >
                      Warranty notes{" "}
                      <span className="font-normal text-zinc-400">(optional)</span>
                    </label>
                    <input
                      id="prd-warranty-notes"
                      type="text"
                      value={draft.warrantyNotes}
                      onChange={(e) =>
                        setDraft({ ...draft, warrantyNotes: e.target.value })
                      }
                      placeholder="e.g. Compressor only"
                      className={field}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <StepError message={error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit">{editingId ? "Save Changes" : "Add Product"}</Button>
          </div>
        </form>
      ) : null}

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {setup.products.length === 0 && !showForm ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
          <Button onClick={onNext}>Continue</Button>
        </div>
      </div>
    </Card>
  );
}
