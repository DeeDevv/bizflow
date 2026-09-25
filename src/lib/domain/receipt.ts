import type { CompletedSale } from "../employee-sales";
import { getBusinessInfo } from "../business-store";

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
