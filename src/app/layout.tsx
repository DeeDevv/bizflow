import type { Metadata } from "next";
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
    default: "BizFlow — Business Management Dashboard",
    template: "%s · BizFlow",
  },
  description:
    "BizFlow is a modern business management dashboard for revenue, sales, customers, and invoices — built for international businesses.",
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
