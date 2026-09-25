/**
 * Business types captured during setup (Phase 2).
 *
 * BizMate is not hard-coded to one industry: the owner's selection tells
 * BizMate what kind of business it is so terminology and workflows can adapt
 * in later phases. For now the UI only captures the choice.
 */

export const BUSINESS_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale / Distribution" },
  { value: "food", label: "Restaurant / Food" },
  { value: "beauty", label: "Salon / Beauty" },
  { value: "repair", label: "Repair / Service" },
  { value: "agency", label: "Agency / Creative" },
  { value: "construction", label: "Construction / Contractor" },
  { value: "online", label: "Online / WhatsApp Business" },
  { value: "other", label: "Other" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export function businessTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((t) => t.value === value)?.label ?? "";
}
