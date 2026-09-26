import type { Metadata } from "next";
import { EndOfDayReportView } from "@/components/dashboard/EndOfDayReport";

export const metadata: Metadata = {
  title: "End-of-Day Report",
};

/**
 * End-of-Day Business Report (Phase 7). A standalone daily record:
 * today's sales, the financial picture (value vs received vs outstanding),
 * and the complete current stock after the day's activity. All data is
 * derived from the domain layer by EndOfDayReportView — no page-level
 * calculations.
 */
export default function ReportPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EndOfDayReportView />
    </div>
  );
}
