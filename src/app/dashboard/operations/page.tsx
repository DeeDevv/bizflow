import type { Metadata } from "next";
import { OperationsCenter } from "@/components/dashboard/OperationsCenter";

export const metadata: Metadata = {
  title: "Operations Center",
};

/**
 * Manager Operations Center (Phase 8.5): the manager's home surface —
 * alerts, follow-up board, team attendance and activity, latest payments.
 * Data is entirely from the shared domain layer.
 */
export default function OperationsPage() {
  return <OperationsCenter />;
}
