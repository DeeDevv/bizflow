import type { Metadata } from "next";
import { Transactions } from "@/components/employee/Transactions";

export const metadata: Metadata = {
  title: "Transactions",
};

export default function EmployeeTransactionsPage() {
  return <Transactions />;
}
