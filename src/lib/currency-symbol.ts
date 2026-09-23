/**
 * Currency symbols for ISO codes, shared across the app.
 *
 * The database always stores the ISO code (NGN, USD, …); symbols are for
 * display only. Unknown or legacy codes fall back to "$" so existing
 * records can never break rendering.
 */

const SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "C$",
  AUD: "A$",
  ZAR: "R",
  GHS: "₵",
  KES: "KSh",
  INR: "₹",
  AED: "د.إ",
  JPY: "¥",
  SGD: "S$",
  BRL: "R$",
};

/** Symbol for an ISO code; "$" when the code is unknown. */
export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? "$";
}

const plainMoney = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "₦2,500.00" — the business's own currency shown with its symbol.
 * No conversion: the number is formatted exactly as stored.
 */
export function formatMoney(value: number, code: string): string {
  return currencySymbol(code) + plainMoney.format(value);
}

const wholeMoney = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "₦101,980" — the business's currency, no decimals (KPI cards). */
export function formatMoneyWhole(value: number, code: string): string {
  return currencySymbol(code) + wholeMoney.format(value);
}
