import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/domain/stock-state";

/** The one stock-status pill: same colors and label everywhere (Phase 5). */
export function StockStatusPill({
  status,
  label,
}: {
  status: StockStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium",
        status === "out" && "bg-red-50 text-red-700",
        status === "low" && "bg-amber-50 text-amber-700",
        status === "in" && "bg-emerald-50 text-emerald-700",
      )}
    >
      {label}
    </span>
  );
}
