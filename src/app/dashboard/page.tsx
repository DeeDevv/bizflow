import type { Metadata } from "next";
import { CommandCenter } from "@/components/dashboard/CommandCenter";

export const metadata: Metadata = {
  title: "Overview",
};

/**
 * Owner Command Center (Phase 6): the three owner questions —
 * How is my business doing? (today's KPIs) · What needs my attention?
 * (the same engine conditions the bell shows) · What is BizMate noticing?
 * (data-derived observations). All data comes from the existing domain
 * layer via CommandCenter — no competing calculations here.
 */
export default function DashboardOverviewPage() {
  return <CommandCenter />;
}
