import type { Metadata } from "next";
import { ReceiveStock } from "@/components/employee/ReceiveStock";

export const metadata: Metadata = {
  title: "Receive Stock",
};

export default function ReceiveStockPage() {
  return <ReceiveStock />;
}
