/**
 * The currencies a business can operate in (Phase 5.7 list, one source of
 * truth for Business Setup and Settings). The database stores the ISO code;
 * symbols are display-only via lib/currency-symbol.ts.
 */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "NGN", label: "NGN — Nigerian Naira (₦)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "GBP", label: "GBP — British Pound (£)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "CAD", label: "CAD — Canadian Dollar (C$)" },
  { code: "AUD", label: "AUD — Australian Dollar (A$)" },
  { code: "ZAR", label: "ZAR — South African Rand (R)" },
  { code: "GHS", label: "GHS — Ghanaian Cedi (₵)" },
  { code: "KES", label: "KES — Kenyan Shilling (KSh)" },
  { code: "INR", label: "INR — Indian Rupee (₹)" },
  { code: "AED", label: "AED — UAE Dirham (د.إ)" },
  { code: "JPY", label: "JPY — Japanese Yen (¥)" },
  { code: "SGD", label: "SGD — Singapore Dollar (S$)" },
  { code: "BRL", label: "BRL — Brazilian Real (R$)" },
];
