import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SplashScreen } from "@/components/SplashScreen";
import { AuthProvider } from "@/lib/auth-store";

// Professional SaaS pairing: Inter for body/UI text, Plus Jakarta Sans for
// headings and display. Both self-host via next/font — no runtime request,
// no layout shift.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BizMate — Simple business management",
    template: "%s · BizMate",
  },
  description:
    "BizMate — Simple business management for growing businesses. Track sales, customers, invoices, payments, and receipts in one clean dashboard.",
  openGraph: {
    title: "BizMate — Simple business management",
    description:
      "BizMate — Simple business management for growing businesses. Track sales, customers, invoices, payments, and receipts in one clean dashboard.",
    siteName: "BizMate",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BizMate — Simple business management",
    description:
      "BizMate — Simple business management for growing businesses.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <SplashScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
