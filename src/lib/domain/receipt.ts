import type { CompletedSale } from "../employee-sales";
import { getBusinessInfo } from "../business-store";
import { formatMoney } from "../currency-symbol";

/**
 * Receipt data (Phase 4) — ONE structured builder consumed by the receipt
 * UI (spec §12: "Do not duplicate receipt calculations in multiple places").
 *
 * Takes the processed transaction (CompletedSale) plus business details and
 * produces the printable structure. Printing/WhatsApp sending stay UI
 * concerns for later phases.
 */

export interface ReceiptData {
  business: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  transaction: {
    reference: string;
    dateTime: string;
    employeeName: string;
  };
  customer: {
    name: string;
    phone: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    /** PRICING SNAPSHOT (spec §4) — present when the manager had a discount on. */
    pricing?: {
      regularPrice: number;
      discountPercent: number;
      discountAmount: number;
      finalUnitPrice: number;
    };
  }>;
  subtotal: number;
  discountPercent: number | null;
  discountAmount: number;
  total: number;
  payment: {
    status: "paid" | "part" | "unpaid";
    statusLabel: string;
    method: string | null;
    methodLabel: string | null;
    amountPaid: number;
    balance: number;
  };
}

export function paymentStatusLabel(status: "paid" | "part" | "unpaid"): string {
  return status === "part" ? "Part-paid" : status === "paid" ? "Paid" : "Unpaid";
}

export function paymentMethodLabel(method: string | null): string | null {
  switch (method) {
    case "cash":
      return "Cash";
    case "transfer":
      return "Bank Transfer";
    case "pos":
      return "POS";
    case "other":
      return "Other";
    default:
      return null;
  }
}

/* ---------------- Digital-first sharing (Phase 8.5, spec §9) ------------- */

/**
 * Plain-text receipt the employee can paste into WhatsApp, or BizMate can
 * hand to the native share sheet. Digital-first: no printer required.
 */
export function receiptShareText(sale: CompletedSale): string {
  const business = getBusinessInfo();
  const money = (v: number) => formatMoney(v, business.currency || "NGN");
  const lines: string[] = [];
  lines.push(`*${business.name || "BizMate"}*`);
  lines.push(`Receipt ${sale.reference}`);
  lines.push(`Date: ${new Date(sale.completedAt).toLocaleString("en-US")}`);
  lines.push(`Customer: ${sale.customerName}`);
  lines.push("");
  for (const item of sale.items) {
    const p = item.pricing;
    if (p && p.discountPercent > 0) {
      lines.push(
        `${item.name} ×${item.quantity} — regular ${money(p.regularPrice)}, −${p.discountPercent}% = ${money(item.unitPrice)} each`,
      );
    } else {
      lines.push(`${item.name} ×${item.quantity} — ${money(item.unitPrice)} each`);
    }
  }
  lines.push("");
  lines.push(`Total: ${money(sale.total)}`);
  lines.push(`Paid: ${money(sale.amountPaid)}`);
  if (sale.balance > 0) lines.push(`Balance due: ${money(sale.balance)}`);
  lines.push(`Payment: ${paymentStatusLabel(sale.paymentStatus)}`);
  if (business.phone) lines.push(`\n${business.phone}`);
  return lines.join("\n");
}

/** wa.me deep link — standard WhatsApp click-to-chat, no API keys. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Trigger a text-file download of the receipt (digital-first, spec §9). */
export function downloadReceiptText(sale: CompletedSale): void {
  const blob = new Blob([receiptShareText(sale)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${sale.reference}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Native share when the device supports it; returns false when not. */
export function nativeShareReceipt(sale: CompletedSale): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return Promise.resolve(false);
  return navigator
    .share({
      title: `Receipt ${sale.reference}`,
      text: receiptShareText(sale),
    })
    .then(() => true)
    .catch(() => false);
}

/** Build the receipt structure from the processed transaction. */
export function buildReceiptData(sale: CompletedSale): ReceiptData {
  const business = getBusinessInfo();
  return {
    business: {
      name: business.name || "BizMate",
      phone: business.phone,
      email: business.email,
      address: business.address,
    },
    transaction: {
      reference: sale.reference,
      dateTime: sale.completedAt,
      employeeName: sale.employeeName,
    },
    customer: {
      name: sale.customerName,
      phone: sale.customerPhone,
    },
    items: sale.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.quantity,
      pricing: i.pricing,
    })),
    subtotal: sale.subtotal,
    discountPercent: sale.discountPercent,
    discountAmount: sale.discountAmount,
    total: sale.total,
    payment: {
      status: sale.paymentStatus,
      statusLabel: paymentStatusLabel(sale.paymentStatus),
      method: sale.method,
      methodLabel: paymentMethodLabel(sale.method),
      amountPaid: sale.amountPaid,
      balance: sale.balance,
    },
  };
}
