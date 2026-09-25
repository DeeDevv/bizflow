import type { Metadata } from "next";
import { ProductInventoryDetail } from "@/components/employee/ProductInventoryDetail";

export const metadata: Metadata = {
  title: "Product Inventory",
};

export default async function ProductInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductInventoryDetail productId={id} />;
}
