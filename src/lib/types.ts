/**
 * Core domain types for BizFlow.
 * API-shaped so a future backend can slot in without UI redesign.
 */

export type InvoiceStatus = "paid" | "pending" | "overdue" | "draft";

/** The five sections a small-business owner needs. */
export type NavIcon =
  | "home"
  | "customers"
  | "invoices"
  | "sales"
  | "products"
  | "settings";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

/** A customer's contact info. */
export interface CustomerInput {
  name: string;
  email: string;
  phone: string;
}

export interface Customer extends CustomerInput {
  id: string;
}

/** One line on an invoice: what was sold, how much, at what price. */
export interface InvoiceItem {
  /** What was sold, e.g. "Website design package" */
  description: string;
  quantity: number;
  /** Price per unit, in USD */
  unitPrice: number;
}

/** A discount on the whole invoice: a percentage off, or a fixed amount off. */
export type DiscountInput = {
  type: "percent" | "fixed";
  /** For "percent": 0–100. For "fixed": a USD amount. */
  value: number;
};

export interface InvoiceInput {
  customerId: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  /** Optional discount applied to the invoice subtotal. Omit for none. */
  discount?: DiscountInput | null;
  status: InvoiceStatus;
}

export interface Invoice extends InvoiceInput {
  id: string;
  /** Invoice number shown to users, e.g. "INV-2041" */
  number: string;
  /** When payment was received (ISO date). Set only for paid invoices. */
  paidAt?: string;
}

/** One payment received against an invoice (Phase 5.8). */
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  /** Amount received, in the business currency. */
  amount: number;
  /** Optional note from the owner. */
  note: string | null;
  /** Payment method (Cash, Transfer, …) — reserved; null until the UI offers it. */
  method: string | null;
  /** When the money arrived (ISO date-time). Everything Phase 5.9 receipts need. */
  paidAt: string;
}

/**
 * Frozen data inside a receipt (Phase 5.9). Copied at creation time so the
 * receipt stays accurate even if the business, customer, product, or
 * currency changes later.
 */
export interface ReceiptSnapshot {
  receiptNumber: string;
  issuedAt: string;
  currency: string;
  business: {
    name: string;
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
    logoUrl: string;
  };
  customer: { name: string; email: string; phone: string };
  invoice: { id: string; number: string; issueDate: string; dueDate: string };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: { type: "percent" | "fixed"; value: number; amount: number } | null;
  total: number;
  payment: {
    id: string;
    amount: number;
    method: string | null;
    note: string | null;
    paidAt: string;
  };
  /** This payment's amount. */
  amountPaid: number;
  /** All payments recorded on the invoice when the receipt was created. */
  totalPaidToDate: number;
  /** Invoice total minus total paid, at creation time. */
  remainingBalance: number;
}

/** Your own business details, printed on invoices and receipts. */
export interface BusinessInfo {
  /** Internal: database row id (set once loaded/saved; never shown in UI). */
  id?: string;
  name: string;
  email: string;
  phone: string;
  /** Street address shown on invoices/receipts. */
  address: string;
  /** WhatsApp number for customer contact (same as phone for most owners). */
  whatsapp: string;
  /** ISO 4217 code (USD, EUR, GBP, NGN…). Used for all money display later. */
  currency: string;
  /** Data-URL or remote URL for the logo; empty = show initials. */
  logoUrl: string;
  /** Whether this business offers discounts (Phase 3 invoice workflow reads this). */
  discountsEnabled: boolean;
}

/** One sellable product or service in the catalog. */
export interface Product {
  id: string;
  name: string;
  /** Selling price per unit, in the business currency. */
  price: number;
  /** Units on hand; for services a large number or 0 = unlimited. */
  stock: number;
  /** Optional image (data-URL or remote URL); empty = initials tile. */
  imageUrl: string;
}

export interface SalesPoint {
  /** ISO date (first of month) */
  date: string;
  /** Sales in USD for that month */
  sales: number;
}
