import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SplashScreen } from "@/components/SplashScreen";
import { AuthProvider } from "@/lib/auth-store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BizFlow — Business Management Dashboard",
    template: "%s · BizFlow",
  },
  description:
    "BizFlow is a modern business management dashboard for revenue, sales, customers, and invoices — built for international businesses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
      <AuthProvider>
        <SplashScreen />
        {children}
      </AuthProvider>
    </body>
    </html>
  );
}
