import { cn } from "@/lib/utils";
import { invoiceStatusLabel } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

const statusStyles: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  overdue: "bg-red-50 text-red-700 ring-red-600/20",
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

const dotStyles: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-500",
  pending: "bg-amber-500",
  overdue: "bg-red-500",
  draft: "bg-zinc-400",
};

/** Small pill badge for invoice statuses. */
export function StatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotStyles[status])} />
      {invoiceStatusLabel[status]}
    </span>
  );
}
