import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CustomersProvider } from "@/lib/customers-store";
import { InvoicesProvider } from "@/lib/invoices-store";
import { ProductsProvider } from "@/lib/products-store";
import { BusinessProvider } from "@/lib/business-store";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <CustomersProvider>
        <InvoicesProvider>
          <ProductsProvider>
            <div className="min-h-dvh">
              <Sidebar />
              <div className="flex min-h-dvh flex-col lg:pl-64">
                <Topbar title="Business" />
                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
              </div>
            </div>
          </ProductsProvider>
        </InvoicesProvider>
      </CustomersProvider>
    </BusinessProvider>
  );
}
