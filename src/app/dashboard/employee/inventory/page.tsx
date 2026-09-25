import type { Metadata } from "next";
import { EmployeeInventory } from "@/components/employee/EmployeeInventory";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function EmployeeInventoryPage() {
  return <EmployeeInventory />;
}
