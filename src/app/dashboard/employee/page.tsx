import type { Metadata } from "next";
import { EmployeeHome } from "@/components/dashboard/EmployeeHome";

export const metadata: Metadata = {
  title: "Employee",
};

export default function EmployeeHomePage() {
  return <EmployeeHome />;
}
