import type { Customer, Invoice } from "./types";
import { invoiceAmount } from "./invoice-utils";

/**
 * Per-customer numbers, computed from the dataset.
 * "Total purchases" = everything ever billed (paid + awaiting payment).
 * "Outstanding" = money the customer still owes (pending + overdue invoices).
 */

export function getCustomerInvoices(customerId: string, invoices: Invoice[]): Invoice[] {
  return invoices.filter((inv) => inv.customerId === customerId);
}

/** Sum of all non-draft invoice amounts for a customer. */
export function getCustomerTotalPurchases(customerId: string, invoices: Invoice[]): number {
  return getCustomerInvoices(customerId, invoices)
    .filter((inv) => inv.status !== "draft")
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0);
}

/** Sum of pending + overdue invoices for a customer. */
export function getCustomerOutstanding(customerId: string, invoices: Invoice[]): number {
  return getCustomerInvoices(customerId, invoices)
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .reduce((sum, inv) => sum + invoiceAmount(inv), 0);
}

export function getCustomerById(
  id: string,
  customers: Customer[],
): Customer | undefined {
  return customers.find((c) => c.id === id);
}
