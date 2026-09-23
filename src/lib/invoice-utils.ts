import type { DiscountInput, Invoice, InvoiceItem } from "./types";

/** Sum of a set of line items. */
export function invoiceSubtotal(items: InvoiceItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
}

/**
 * Dollar value of a discount against a subtotal, rounded to cents and clamped
 * so the final total can never go below zero.
 */
export function discountAmount(
  discount: DiscountInput | null | undefined,
  subtotal: number,
): number {
  if (
    !discount ||
    !Number.isFinite(discount.value) ||
    discount.value <= 0 ||
    subtotal <= 0
  ) {
    return 0;
  }
  const raw =
    discount.type === "percent"
      ? (subtotal * Math.min(discount.value, 100)) / 100
      : discount.value;
  return Math.min(Math.round(raw * 100) / 100, subtotal);
}

/** Final amount the customer owes: subtotal minus discount, never negative. */
export function invoiceAmount(invoice: Invoice): number {
  const subtotal = invoiceSubtotal(invoice.items);
  const total = subtotal - discountAmount(invoice.discount, subtotal);
  return Math.max(0, Math.round(total * 100) / 100);
}

/** Relative due-date text, e.g. "in 4 days" / "9 days late" */
export function formatDueIn(iso: string, now: Date = new Date()): string {
  const diffDays = Math.round(
    (new Date(iso).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "due today";
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} late`;
}

/** True when a non-paid invoice is past its due date. */
export function isOverdue(invoice: Invoice, now: Date = new Date()): boolean {
  if (invoice.status === "paid" || invoice.status === "draft") return false;
  return new Date(invoice.dueDate).getTime() < now.getTime();
}

/** Status shown to the user: computed for overdue so it can never go stale. */
export function effectiveStatus(
  invoice: Invoice,
  now: Date = new Date(),
): Invoice["status"] {
  return isOverdue(invoice, now) ? "overdue" : invoice.status;
}
