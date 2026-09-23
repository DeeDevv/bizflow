import type { Metadata } from "next";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";

export const metadata: Metadata = {
  title: "New Invoice",
};

export default function NewInvoicePage() {
  return <InvoiceForm />;
}
