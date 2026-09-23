"use client";

import { use } from "react";
import Link from "next/link";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Button } from "@/components/ui/Button";
import { useInvoices } from "@/lib/invoices-store";

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = use(params);
  const { invoices } = useInvoices();
  const invoice = invoices.find((inv) => inv.id === id);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900">Invoice not found</p>
        <p className="mt-2 text-sm text-zinc-500">
          It may have been removed, or this link is out of date.
        </p>
        <Link href="/dashboard/invoices" className="mt-6 inline-block">
          <Button>Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  return <InvoiceForm invoice={invoice} />;
}
