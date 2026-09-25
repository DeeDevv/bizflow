import type { Metadata } from "next";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { RecentSales } from "@/components/dashboard/RecentSales";
import { AttentionCard } from "@/components/dashboard/AttentionCard";
import { InventoryValueCard } from "@/components/dashboard/InventoryValueCard";

export const metadata: Metadata = {
  title: "Overview",
};

/**
 * Owner Command Center (Phase 2): the three owner questions —
 * How is my business doing? (KPIs) · What needs my attention? (attention
 * card) · What is BizMate noticing? (stock + overdue views, shared with the
 * bell). Sales data stays in Recent Sales; inventory value at cost joins
 * the picture.
 */
export default function DashboardOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Page heading */}
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Here&apos;s how your business is doing today.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:gap-5">
        <KpiCards />
        <AttentionCard />
        <RecentSales />
        <InventoryValueCard />
      </div>
    </div>
  );
}
