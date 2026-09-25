import type { Metadata } from "next";
import { NewSale } from "@/components/employee/NewSale";

export const metadata: Metadata = {
  title: "New Sale",
};

export default function NewSalePage() {
  return <NewSale />;
}
