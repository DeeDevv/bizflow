"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useProducts } from "@/lib/products-store";
import { productPricing, finalUnitPrice, discountPerUnit } from "@/lib/product-meta";
import type { Product } from "@/lib/types";
import { formatCurrencyPrecise } from "@/lib/utils";
import { getBusinessInfo } from "@/lib/business-store";
import { formatMoney } from "@/lib/currency-symbol";

interface ProductFormModalProps {
  /** Present = edit mode; absent = add mode */
  product?: Product;
  onClose: () => void;
}

/** Add / Edit product dialog — the details invoices will reuse later. */
export function ProductFormModal({ product, onClose }: ProductFormModalProps) {
  const { addProduct, updateProduct } = useProducts();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  // Manager pricing (Phase 8.5, spec §4): the MANAGER sets the regular
  // price and discount %; BizMate computes amount + final price. Existing
  // products carry their configured pricing into the form.
  const existingPricing = product ? productPricing(product.name) : null;
  const [regularPrice, setRegularPrice] = useState(
    existingPricing ? String(existingPricing.regularPrice) : product ? String(product.price) : "",
  );
  const [discountPercent, setDiscountPercent] = useState(
    existingPricing && existingPricing.discountPercent > 0
      ? String(existingPricing.discountPercent)
      : "",
  );

  const parsedRegular = Number.parseFloat(regularPrice);
  const parsedDiscount =
    discountPercent.trim() === "" ? 0 : Number.parseFloat(discountPercent);
  const discountValid =
    discountPercent.trim() === "" ||
    (Number.isFinite(parsedDiscount) && parsedDiscount > 0 && parsedDiscount < 100);
  const computedFinal =
    Number.isFinite(parsedRegular) && parsedRegular >= 0 && discountValid
      ? finalUnitPrice(parsedRegular, parsedDiscount || 0)
      : null;
  const computedDiscountAmount =
    Number.isFinite(parsedRegular) && parsedRegular >= 0 && discountValid
      ? discountPerUnit(parsedRegular, parsedDiscount || 0)
      : null;

  const isEdit = product != null;

  useEffect(() => {
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastActiveRef.current?.focus();
    };
  }, [onClose]);

  function handleImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Please choose an image under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsedPrice = Number.parseFloat(price);
    const parsedStock = Number.parseInt(stock, 10);

    if (!trimmedName) {
      setError("Please enter a product name.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Please enter a valid selling price.");
      return;
    }
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setError("Please enter a valid stock quantity (0 or more).");
      return;
    }
    // Manager pricing validation (spec §4).
    if (!Number.isFinite(parsedRegular) || parsedRegular < 0) {
      setError("Please enter a valid regular price.");
      return;
    }
    if (!discountValid) {
      setError("Discount must be between 0 and 100 percent.");
      return;
    }

    const finalPrice = computedFinal ?? parsedPrice;
    const input = {
      name: trimmedName,
      price: finalPrice,
      stock: parsedStock,
      imageUrl,
    };
    // Save to the database first; only close on success so the owner's
    // input is never lost to a failed save.
    const saved = isEdit
      ? await updateProduct(product.id, input)
      : await addProduct(input);
    if (!saved) {
      setError("Could not save — please try again in a moment.");
      return;
    }
    // Persist the manager pricing alongside the catalog record (keyed by
    // name, like the other setup extras).
    try {
      const raw = localStorage.getItem("bizmate.setup.v1");
      let parsed = raw ? JSON.parse(raw) : {};
      const state = parsed.state ?? parsed;
      state.productExtras = state.productExtras ?? {};
      state.productExtras[trimmedName] = {
        ...state.productExtras[trimmedName],
        pricing: {
          regularPrice: Math.round(parsedRegular * 100) / 100,
          discountPercent: parsedDiscount || 0,
        },
      };
      if (parsed.state) parsed.state = state;
      else parsed = state;
      localStorage.setItem("bizmate.setup.v1", JSON.stringify(parsed));
    } catch {
      // Extras persistence is best-effort; the catalog save already succeeded.
    }
    onClose();
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit product" : "Add product"}
        className="animate-rise-in relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEdit ? "Edit Product" : "Add Product"}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEdit
                ? "Update this product's details."
                : "Add something you sell. The price is reused on invoices."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label htmlFor="product-name" className="text-sm font-medium text-zinc-700">
              Product name
            </label>
            <input
              id="product-name"
              ref={firstFieldRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Design Package"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="product-regular-price" className="text-sm font-medium text-zinc-700">
                Regular Price
              </label>
              <input
                id="product-regular-price"
                type="number"
                min={0}
                step="0.01"
                value={regularPrice}
                onChange={(e) => {
                  setRegularPrice(e.target.value);
                  // Keep the catalog price in step with the computed final
                  // so existing views stay truthful.
                  const r = Number.parseFloat(e.target.value);
                  if (Number.isFinite(r) && r >= 0) {
                    setPrice(String(finalUnitPrice(r, parsedDiscount || 0)));
                  }
                }}
                placeholder="0.00"
                className={`${field} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor="product-discount" className="text-sm font-medium text-zinc-700">
                Discount % <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="product-discount"
                type="number"
                min={0}
                max={99.99}
                step="0.01"
                value={discountPercent}
                onChange={(e) => {
                  setDiscountPercent(e.target.value);
                  const d = Number.parseFloat(e.target.value) || 0;
                  if (Number.isFinite(parsedRegular) && parsedRegular >= 0) {
                    setPrice(String(finalUnitPrice(parsedRegular, d)));
                  }
                }}
                placeholder="e.g. 5"
                className={`${field} tabular-nums`}
              />
            </div>
          </div>
          {computedFinal !== null && computedDiscountAmount !== null ? (
            <div className="-mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs">
              {computedDiscountAmount > 0 ? (
                <>
                  <p className="text-zinc-500">
                    Discount amount:{" "}
                    <span className="font-medium tabular-nums text-amber-700">
                      −{formatMoney(computedDiscountAmount, getBusinessInfo().currency || "NGN")}
                    </span>{" "}
                    per unit
                  </p>
                  <p className="mt-0.5 font-medium text-zinc-900">
                    Final price:{" "}
                    <span className="tabular-nums">
                      {formatMoney(computedFinal, getBusinessInfo().currency || "NGN")}
                    </span>{" "}
                    <span className="font-normal text-zinc-400">
                      — what employees will sell at
                    </span>
                  </p>
                </>
              ) : (
                <p className="font-medium text-zinc-900">
                  Final price:{" "}
                  <span className="tabular-nums">
                    {formatMoney(computedFinal, getBusinessInfo().currency || "NGN")}
                  </span>
                </p>
              )}
            </div>
          ) : null}

          <div>
            <label htmlFor="product-stock" className="text-sm font-medium text-zinc-700">
              Stock quantity
            </label>
            <input
              id="product-stock"
              type="number"
              min={0}
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              className={`${field} tabular-nums`}
            />
          </div>
          <p className="-mt-2 text-xs text-zinc-400">
            For a service, set stock to 0 — it shows as &ldquo;Out of stock&rdquo; but can
            still be quoted.
          </p>

          {/* Optional image */}
          <div>
            <span className="text-sm font-medium text-zinc-700">
              Product image <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <div className="mt-2 flex items-center gap-3">
              {imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview */}
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    aria-label="Remove image"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 p-1 text-white shadow hover:bg-red-600"
                  >
                    <Trash2 aria-hidden className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400"
                >
                  <ImagePlus className="h-5 w-5" />
                </span>
              )}
              <label
                htmlFor="product-image"
                className="cursor-pointer rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {imageUrl ? "Change image" : "Upload image"}
              </label>
              <input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={(e) => handleImage(e.target.files?.[0])}
                className="sr-only"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save Changes" : "Add Product"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Formats the price for the tiny preview line inside the dialog. */
export function pricePreview(value: number): string {
  return formatCurrencyPrecise(value);
}
