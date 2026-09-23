import type { Invoice, InvoicePayment } from "./types";
import { invoiceAmount } from "./invoice-utils";

/**
 * A sale = a paid invoice, viewed as a completed transaction.
 * Derived from the invoices store (never stored separately), so sales can
 * never disagree with invoice amounts, discounts, or statuses.
 */
export interface Sale {
  /** Same id as the invoice it came from. */
  id: string;
  /** Invoice number shown to the customer, e.g. "INV-2036" */
  number: string;
  invoice: Invoice;
  /** Final amount received: subtotal minus discount. */
  amount: number;
  /** Date of the sale (ISO date) — when payment was received. */
  date: string;
  customerName: string;
}

/** Map paid invoices to sale records, newest first. */
export function toSales(
  invoices: Invoice[],
  customerNames: Map<string, string>,
): Sale[] {
  return invoices
    .filter((inv) => inv.status === "paid")
    .map((inv) => ({
      id: inv.id,
      number: inv.number,
      invoice: inv,
      amount: invoiceAmount(inv),
      date: inv.paidAt ?? inv.dueDate,
      customerName: customerNames.get(inv.customerId) ?? "Unknown customer",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Money actually received across a set of sales. */
export function salesTotal(sales: Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.amount, 0);
}

/**
 * Money actually received for one invoice (Phase 5.10 revenue basis):
 * real payment records for invoices still open, and the full amount for
 * invoices finalized as paid — "Mark as Paid" asserts the money arrived
 * (a typical cash sale) even though it has no payment row. Never counts
 * drafts and never exceeds the invoice amount.
 */
export function receivedFor(invoice: Invoice, paidSoFar: number): number {
  if (invoice.status === "draft") return 0;
  const amount = invoiceAmount(invoice);
  if (invoice.status === "paid") return amount;
  return Math.min(Math.max(0, paidSoFar), amount);
}

/** One received payment, ready for display (dashboard "Recent Sales"). */
export interface ReceivedEvent {
  id: string;
  /** Invoice the payment landed on — links to its sale details. */
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  /** ISO date-time the payment was received. */
  date: string;
}

/** Map real payment records to display rows, newest first. */
export function toReceivedEvents(
  payments: InvoicePayment[],
  invoices: Invoice[],
  customerNames: Map<string, string>,
): ReceivedEvent[] {
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
  return payments
    .map((payment) => {
      const invoice = invoiceById.get(payment.invoiceId);
      return {
        id: payment.id,
        invoiceId: payment.invoiceId,
        invoiceNumber: invoice?.number ?? "—",
        customerId: invoice?.customerId ?? "",
        customerName:
          invoice != null
            ? (customerNames.get(invoice.customerId) ?? "Unknown customer")
            : "Unknown customer",
        amount: payment.amount,
        date: payment.paidAt,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
