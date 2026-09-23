"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgePercent, Check, Plus, Trash2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useCustomers } from "@/lib/customers-store";
import { useInvoices } from "@/lib/invoices-store";
import { useProducts } from "@/lib/products-store";
import { useBusiness } from "@/lib/business-store";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency-symbol";
import { discountAmount, invoiceSubtotal } from "@/lib/invoice-utils";
import type {
  DiscountInput,
  Invoice,
  InvoiceItem,
  InvoiceInput,
  InvoiceStatus,
} from "@/lib/types";

interface InvoiceFormProps {
  /** Present = edit mode (loads this invoice). Absent = create mode. */
  invoice?: Invoice;
}

/** Simple 3-step invoice form: Customer → Items → Review & save. */
export function InvoiceForm({ invoice }: InvoiceFormProps) {
  const router = useRouter();
  const { customers } = useCustomers();
  const { nextNumber, createInvoice, updateInvoice } = useInvoices();
  const { products } = useProducts();
  const { business } = useBusiness();
  const discountsEnabled = business.discountsEnabled;

  const isEdit = invoice != null;

  /* ---------------- Step state ---------------- */
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — customer
  const [customerId, setCustomerId] = useState(invoice?.customerId ?? "");
  const [addOpen, setAddOpen] = useState(false);

  // Step 2 — items
  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items?.length ? invoice.items : [{ description: "", quantity: 1, unitPrice: 0 }],
  );
  const [itemsError, setItemsError] = useState<string | null>(null);
  // Catalog picker: which product is about to be added as a line item.
  const [productToUse, setProductToUse] = useState("");

  // Optional discount — null = none. Toggled in step 2, shown in the summary.
  const [discount, setDiscount] = useState<DiscountInput | null>(
    invoice?.discount ?? null,
  );
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");

  // Step 3 — dates & review
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? today);
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? in30Days());
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "pending");
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => invoiceSubtotal(items), [items]);
  const discountValue = discountAmount(discount, subtotal);
  const total = Math.max(0, Math.round((subtotal - discountValue) * 100) / 100);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const discountPercent =
    discount?.type === "percent" ? Math.min(Math.max(discount.value, 0), 100) : 0;

  function applyDiscount() {
    const parsed = Number.parseFloat(discountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setDiscount({
      type: discountType,
      value:
        discountType === "percent"
          ? Math.min(parsed, 100)
          : Math.max(0, parsed),
    });
    setDiscountInput("");
  }

  /* ---------------- Validation ---------------- */
  const step1Valid = customerId !== "";
  const step2Valid =
    items.length > 0 &&
    items.every((it) => it.description.trim() !== "") &&
    items.every((it) => Number.isFinite(it.quantity) && it.quantity > 0) &&
    items.every((it) => Number.isFinite(it.unitPrice) && it.unitPrice >= 0);

  function nextFromStep1() {
    if (!step1Valid) {
      setError("Choose a customer to continue.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function nextFromStep2() {
    if (!step2Valid) {
      setItemsError("Each line needs a description, a quantity of 1 or more, and a price.");
      return;
    }
    setItemsError(null);
    setStep(3);
  }

  /* ---------------- Save ---------------- */
  async function handleSave() {
    if (!step1Valid || !step2Valid) {
      setError("Something is missing — go back and check each step.");
      return;
    }
    const input: InvoiceInput = {
      customerId,
      issueDate,
      dueDate,
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: Math.max(1, Math.round(it.quantity)),
        unitPrice: Math.max(0, it.unitPrice),
      })),
      discount,
      status,
    };

    // Stock guard: a line that names a catalog product cannot ask for more
    // units than exist. (Paid invoices don't deduct stock, so they skip this.)
    if (status !== "paid") {
      for (const line of input.items) {
        const product = products.find((p) => p.name === line.description);
        if (product && line.quantity > product.stock) {
          setError(
            `Not enough stock for ${product.name} — ${product.stock} left, you asked for ${line.quantity}.`,
          );
          return;
        }
      }
    }

    // Save to the database first; only navigate on success so the owner's
    // work is never lost to a failed save.
    const saved = isEdit
      ? await updateInvoice(invoice.id, input)
      : await createInvoice(input);
    if (!saved) {
      setError("Could not save the invoice — please try again in a moment.");
      return;
    }
    router.push(`/dashboard/invoices/${saved.id}`);
  }

  /* ---------------- Item rows ---------------- */
  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeDiscount() {
    setDiscount(null);
    setDiscountInput("");
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-3xl">
      {/* Back + heading */}
      <div className="pb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back
        </button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {isEdit ? `Edit ${invoice.number}` : "New Invoice"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isEdit
            ? "Change what's on this invoice."
            : "Who you're billing, what you sold, and when payment is due."}
        </p>
      </div>

      {/* Step indicator */}
      <ol className="mb-5 flex items-center gap-2 text-sm" aria-label="Progress">
        {(["Customer", "Items", "Review"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const state =
            step === n ? "current" : step > n ? "done" : "todo";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  state === "current" && "bg-brand-600 text-white",
                  state === "done" && "bg-brand-100 text-brand-700",
                  state === "todo" && "bg-zinc-100 text-zinc-400",
                )}
              >
                {state === "done" ? <Check aria-hidden className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={cn("font-medium", state === "todo" ? "text-zinc-400" : "text-zinc-700")}>
                {label}
              </span>
              {i < 2 ? <span aria-hidden className="mx-1 text-zinc-300">—</span> : null}
            </li>
          );
        })}
      </ol>

      {/* ---------------- STEP 1: Customer ---------------- */}
      {step === 1 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Who are you billing?</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Pick an existing customer, or add a new one.</p>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Choose customer">
            {customers.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={customerId === c.id}
                onClick={() => {
                  setCustomerId(c.id);
                  setError(null);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                  customerId === c.id
                    ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    customerId === c.id ? "bg-brand-100 text-brand-700" : "bg-zinc-100 text-zinc-600",
                  )}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{c.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{c.email}</span>
                </span>
                {customerId === c.id ? (
                  <Check aria-hidden className="h-4 w-4 shrink-0 text-brand-600" />
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <UserPlus aria-hidden className="h-4 w-4" />
              Add New Customer
            </Button>
            <Button onClick={nextFromStep1} disabled={!step1Valid}>
              Next: Items
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : null}

      {/* ---------------- STEP 2: Items ---------------- */}
      {step === 2 ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">What did you sell?</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                The total is worked out for you automatically.
              </p>
            </div>
            {selectedCustomer ? (
              <p className="shrink-0 text-sm text-zinc-500">
                For <span className="font-medium text-zinc-900">{selectedCustomer.name}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Item {index + 1}
                  </p>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      aria-label={`Remove item ${index + 1}`}
                      className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end">
                  <div className="sm:col-span-1">
                    <label htmlFor={`item-desc-${index}`} className="text-xs font-medium text-zinc-600">
                      Description
                    </label>
                    <input
                      id={`item-desc-${index}`}
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="e.g. Website design package"
                      className={cn(inputClass, "mt-1")}
                    />
                  </div>
                  <div>
                    <label htmlFor={`item-qty-${index}`} className="text-xs font-medium text-zinc-600">
                      Qty
                    </label>
                    <input
                      id={`item-qty-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.valueAsNumber })}
                      className={cn(inputClass, "mt-1 tabular-nums")}
                    />
                  </div>
                  <div>
                    <label htmlFor={`item-price-${index}`} className="text-xs font-medium text-zinc-600">
                      Unit price
                    </label>
                    <input
                      id={`item-price-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, { unitPrice: e.target.valueAsNumber || 0 })}
                      className={cn(inputClass, "mt-1 tabular-nums")}
                    />
                  </div>
                  <div className="pb-2 text-right sm:w-24">
                    <p className="text-xs font-medium text-zinc-600">Amount</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                      {formatMoney(item.quantity * item.unitPrice, business.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {itemsError ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {itemsError}
            </p>
          ) : null}

          {/* Add a product from the catalog — its current price fills the row.
              The stored invoice keeps this price even if the product changes later. */}
          {products.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
              <div className="min-w-44 flex-1">
                <label htmlFor="pick-product" className="text-xs font-medium text-zinc-600">
                  Add a product
                </label>
                <select
                  id="pick-product"
                  value={productToUse}
                  onChange={(e) => setProductToUse(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                >
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.price, business.currency)}
                      {p.stock > 0 ? ` (${formatNumber(p.stock)} in stock)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const product = products.find((p) => p.id === productToUse);
                  if (!product) return;
                  setItems((prev) => [
                    ...prev,
                    { description: product.name, quantity: 1, unitPrice: product.price },
                  ]);
                  setProductToUse("");
                  setItemsError(null);
                }}
                disabled={!productToUse}
              >
                <Plus aria-hidden className="h-4 w-4" />
                Add to invoice
              </Button>
            </div>
          ) : null}

          {/* Discount — shown only when enabled in Business Settings */}
          {discountsEnabled ? (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Discount</p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Optional — a percentage or amount off the whole invoice.
                </p>
              </div>
              {discount ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                    <BadgePercent aria-hidden className="h-4 w-4" />
                    {discount.type === "percent"
                      ? `−${discountPercent}% · ${formatMoney(discountValue, business.currency)} off`
                      : `${formatMoney(discountValue, business.currency)} off`}
                  </span>
                  <Button variant="secondary" size="sm" onClick={removeDiscount}>
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
            {!discount ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="w-28">
                  <label htmlFor="discount-value" className="text-xs font-medium text-zinc-600">
                    Discount
                  </label>
                  <input
                    id="discount-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0.00"
                    className={cn(inputClass, "mt-1 tabular-nums")}
                  />
                </div>
                <div className="w-32">
                  <label htmlFor="discount-type" className="text-xs font-medium text-zinc-600">
                    Type
                  </label>
                  <select
                    id="discount-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                    className={cn(inputClass, "mt-1")}
                  >
                    <option value="percent">% off</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <Button variant="secondary" onClick={applyDiscount} disabled={!discountInput}>
                  Apply
                </Button>
              </div>
            ) : null}
          </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}>
              <Plus aria-hidden className="h-4 w-4" />
              Add Another Item
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                Total: <span className="font-semibold text-zinc-900">{formatMoney(total, business.currency)}</span>
              </span>
              <Button onClick={nextFromStep2}>Next: Review</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---------------- STEP 3: Review & save ---------------- */}
      {step === 3 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Check it over, then save.</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            This is exactly what your customer will see.
          </p>

          {/* Mini preview */}
          <div className="mt-4 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Bill to
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{selectedCustomer?.name ?? "—"}</p>
                <p className="text-xs text-zinc-500">{selectedCustomer?.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900">
                  {isEdit ? invoice.number : nextNumber()}
                </p>
                <p className="text-xs text-zinc-500">Issued {formatDate(issueDate)}</p>
                <p className="text-xs text-zinc-500">Due {formatDate(dueDate)}</p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
              {items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-zinc-700">
                    {item.quantity} × {item.description || "—"}
                  </span>
                  <span className="tabular-nums text-zinc-900">
                    {formatMoney(item.quantity * item.unitPrice, business.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Summary: Subtotal → Discount → Final Total */}
            <div className="mt-3 space-y-1.5 border-t border-zinc-200 pt-3">
              <div className="flex items-center justify-between text-sm text-zinc-600">
                <p>Subtotal</p>
                <p className="tabular-nums">{formatMoney(subtotal, business.currency)}</p>
              </div>
              {discount ? (
                <div className="flex items-center justify-between text-sm font-medium text-brand-700">
                  <p>Discount{discount.type === "percent" ? ` (${discountPercent}%)` : ""}</p>
                  <p className="tabular-nums">−{formatMoney(discountValue, business.currency)}</p>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
                <p className="text-sm font-semibold text-zinc-900">Final Total</p>
                <p className="text-lg font-semibold tabular-nums text-zinc-900">
                  {formatMoney(total, business.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Dates + status */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="inv-issue" className="text-sm font-medium text-zinc-700">Issue date</label>
              <input
                id="inv-issue"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
            <div>
              <label htmlFor="inv-due" className="text-sm font-medium text-zinc-700">Due date</label>
              <input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
            <div>
              <label htmlFor="inv-status" className="text-sm font-medium text-zinc-700">Starting status</label>
              <select
                id="inv-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className={cn(inputClass, "mt-1.5")}
              >
                <option value="pending">Pending (they still owe it)</option>
                <option value="paid">Paid (already received)</option>
              </select>
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back to Items
            </Button>
            <Button onClick={handleSave} size="md">
              <Check aria-hidden className="h-4 w-4" />
              {isEdit ? "Save Changes" : "Save Invoice"}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* New-customer modal — adds and selects the customer */}
      {addOpen ? (
        <CustomerFormModal
          onClose={() => setAddOpen(false)}
          onCreated={(created) => {
            setCustomerId(created.id);
            setAddOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
