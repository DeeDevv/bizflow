/**
 * Product categories (Phase 2 setup).
 *
 * The list below is a suggestion catalog — the owner can type their own
 * category (the setup form uses a datalist input, not a locked select), so
 * BizMate never hard-codes one industry's taxonomy.
 *
 * CATEGORY_DETAIL_FIELDS is the Phase 2 structure for category-aware product
 * details: a small set of optional, free-text fields shown only when the
 * matching category is selected. It is deliberately NOT a specification
 * engine — later phases can expand it or move it to the database.
 */

export const PRODUCT_CATEGORIES = [
  "Air Conditioners",
  "Refrigerators",
  "Freezers",
  "Washing Machines",
  "Televisions",
  "Generators",
  "Microwaves",
  "Fans",
  "Other",
] as const;

export interface CategoryField {
  key: string;
  label: string;
  placeholder: string;
}

export const CATEGORY_DETAIL_FIELDS: Record<string, CategoryField[]> = {
  "Air Conditioners": [
    { key: "capacity", label: "Capacity", placeholder: "e.g. 1HP" },
    { key: "type", label: "Type", placeholder: "e.g. Split unit" },
    { key: "inverter", label: "Inverter / Non-Inverter", placeholder: "e.g. Inverter" },
  ],
  Refrigerators: [
    { key: "capacity", label: "Capacity", placeholder: "e.g. 300L" },
    { key: "type", label: "Type", placeholder: "e.g. Double door" },
    { key: "doors", label: "Number of doors", placeholder: "e.g. 2" },
  ],
  Freezers: [
    { key: "capacity", label: "Capacity", placeholder: "e.g. 150L" },
    { key: "type", label: "Type", placeholder: "e.g. Chest freezer" },
  ],
  "Washing Machines": [
    { key: "capacity", label: "Capacity", placeholder: "e.g. 8kg" },
    { key: "type", label: "Type", placeholder: "e.g. Front load" },
  ],
  Televisions: [
    { key: "size", label: "Screen size", placeholder: 'e.g. 55"' },
    { key: "resolution", label: "Resolution", placeholder: "e.g. 4K UHD" },
  ],
  Generators: [
    { key: "power", label: "Power rating", placeholder: "e.g. 5.5KVA" },
    { key: "fuel", label: "Fuel type", placeholder: "e.g. Petrol" },
  ],
  Microwaves: [{ key: "capacity", label: "Capacity", placeholder: "e.g. 20L" }],
  Fans: [{ key: "size", label: "Size", placeholder: 'e.g. 18"' }],
};

/** Optional detail fields for a category; empty for unknown categories. */
export function categoryDetailFields(category: string): CategoryField[] {
  return CATEGORY_DETAIL_FIELDS[category] ?? [];
}
