import type { BusinessInfo, Customer, Invoice, Product } from "./types";

/**
 * Realistic mock data for BizFlow (frontend-only).
 * Customers ↔ invoices are linked; every total in the UI is derived from
 * these records, so numbers can never disagree between pages.
 * In a later phase this module is the only file to swap for real API calls.
 */

/* ------------------------------------------------------------------ */
/* Your business — printed on invoices                                 */
/* ------------------------------------------------------------------ */

export const businessInfo: BusinessInfo = {
  name: "BizFlow Studio LLC",
  email: "billing@bizflow.io",
  phone: "+1 (555) 010-0100",
  address: "418 Harbor Ave, Suite 12, Austin, TX 78701, USA",
  whatsapp: "+1 (555) 010-0100",
  currency: "USD",
  logoUrl: "",
  discountsEnabled: true,
};

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export const seedProducts: Product[] = [
  {
    id: "prd-01",
    name: "Website Design Package",
    price: 7400,
    stock: 8,
    imageUrl: "",
  },
  {
    id: "prd-02",
    name: "E-commerce Build",
    price: 18700,
    stock: 5,
    imageUrl: "",
  },
  {
    id: "prd-03",
    name: "CRM Migration",
    price: 8200,
    stock: 0,
    imageUrl: "",
  },
  {
    id: "prd-04",
    name: "Staff Training Day",
    price: 1600,
    stock: 24,
    imageUrl: "",
  },
  {
    id: "prd-05",
    name: "Fleet Tracking — Vehicle Module",
    price: 3600,
    stock: 12,
    imageUrl: "",
  },
  {
    id: "prd-06",
    name: "Brand Refresh Package",
    price: 6200,
    stock: 3,
    imageUrl: "",
  },
  {
    id: "prd-07",
    name: "IT Health Check",
    price: 950,
    stock: 40,
    imageUrl: "",
  },
];

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export const seedCustomers: Customer[] = [
  {
    id: "cus-01",
    name: "Elena Marchetti",
    email: "elena@atlasmanufacturing.com",
    phone: "+39 40 555 0182",
  },
  {
    id: "cus-02",
    name: "Lars Johansen",
    email: "lars@nordwindlogistics.de",
    phone: "+49 171 555 0421",
  },
  {
    id: "cus-03",
    name: "Aiko Tanaka",
    email: "aiko@sakuradigital.jp",
    phone: "+81 90 5555 3390",
  },
  {
    id: "cus-04",
    name: "Sarah Whitfield",
    email: "sarah@meridianhealth.com",
    phone: "+1 (415) 555-0164",
  },
  {
    id: "cus-05",
    name: "Daniel Okafor",
    email: "daniel@pacificrimtrading.sg",
    phone: "+65 8555 2291",
  },
  {
    id: "cus-06",
    name: "Brightpath Consulting",
    email: "accounts@brightpath.co.uk",
    phone: "+44 7700 555 118",
  },
  {
    id: "cus-07",
    name: "Carlos Mendes",
    email: "carlos@mendesretail.br",
    phone: "+55 11 95555 4402",
  },
  {
    id: "cus-08",
    name: "Priya Sharma",
    email: "priya@sharmatextiles.in",
    phone: "+91 98 5555 7123",
  },
];

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export const seedInvoices: Invoice[] = [
  // Elena Marchetti — owes the overdue Atlas invoice
  {
    id: "inv-2041", number: "INV-2041", customerId: "cus-01",
    issueDate: "2026-08-28", dueDate: "2026-09-12", status: "overdue",
    items: [{ description: "Factory automation rollout", quantity: 1, unitPrice: 23750 }],
  },
  {
    id: "inv-2036", number: "INV-2036", customerId: "cus-01",
    issueDate: "2026-05-08", dueDate: "2026-06-07", status: "paid", paidAt: "2026-05-30",
    items: [{ description: "ERP integration project", quantity: 1, unitPrice: 21500 }],
  },
  {
    id: "inv-2032", number: "INV-2032", customerId: "cus-01",
    issueDate: "2026-03-12", dueDate: "2026-04-11", status: "paid", paidAt: "2026-04-02",
    discount: { type: "fixed", value: 400 },
    items: [{ description: "Website design package", quantity: 1, unitPrice: 7400 }],
  },
  // Lars Johansen — pending
  {
    id: "inv-2040", number: "INV-2040", customerId: "cus-02",
    issueDate: "2026-09-12", dueDate: "2026-10-12", status: "pending",
    items: [{ description: "Fleet tracking — vehicle module", quantity: 4, unitPrice: 3600 }],
  },
  {
    id: "inv-2035", number: "INV-2035", customerId: "cus-02",
    issueDate: "2026-04-19", dueDate: "2026-05-19", status: "paid", paidAt: "2026-05-10",
    items: [{ description: "Fleet tracking setup", quantity: 1, unitPrice: 9800 }],
  },
  // Aiko Tanaka — all settled
  {
    id: "inv-2039", number: "INV-2039", customerId: "cus-03",
    issueDate: "2026-06-14", dueDate: "2026-07-14", status: "paid", paidAt: "2026-07-05",
    items: [{ description: "E-commerce build", quantity: 1, unitPrice: 18700 }],
  },
  {
    id: "inv-2034", number: "INV-2034", customerId: "cus-03",
    issueDate: "2026-02-25", dueDate: "2026-03-27", status: "paid", paidAt: "2026-03-20",
    discount: { type: "percent", value: 10 },
    items: [{ description: "Brand refresh package", quantity: 1, unitPrice: 6200 }],
  },
  // Sarah Whitfield — pending
  {
    id: "inv-2038", number: "INV-2038", customerId: "cus-04",
    issueDate: "2026-09-14", dueDate: "2026-10-14", status: "pending",
    items: [{ description: "Patient portal integration", quantity: 1, unitPrice: 12400 }],
  },
  {
    id: "inv-2033", number: "INV-2033", customerId: "cus-04",
    issueDate: "2026-05-30", dueDate: "2026-06-29", status: "paid", paidAt: "2026-06-24",
    items: [{ description: "Clinic booking system", quantity: 1, unitPrice: 15200 }],
  },
  {
    id: "inv-2031", number: "INV-2031", customerId: "cus-04",
    issueDate: "2026-08-18", dueDate: "2026-09-17", status: "paid", paidAt: "2026-09-05",
    items: [{ description: "Staff training days", quantity: 2, unitPrice: 1600 }],
  },
  // Daniel Okafor — pending
  {
    id: "inv-2037", number: "INV-2037", customerId: "cus-05",
    issueDate: "2026-09-05", dueDate: "2026-10-05", status: "pending",
    items: [{ description: "Import management app — phase 3", quantity: 1, unitPrice: 9600 }],
  },
  {
    id: "inv-2030", number: "INV-2030", customerId: "cus-05",
    issueDate: "2026-04-02", dueDate: "2026-05-02", status: "paid", paidAt: "2026-04-28",
    items: [{ description: "Import management app", quantity: 1, unitPrice: 12800 }],
  },
  // Brightpath
  {
    id: "inv-2029", number: "INV-2029", customerId: "cus-06",
    issueDate: "2026-07-06", dueDate: "2026-08-05", status: "paid", paidAt: "2026-07-30",
    items: [{ description: "CRM migration", quantity: 1, unitPrice: 8200 }],
  },
  // Carlos Mendes — pending
  {
    id: "inv-2042", number: "INV-2042", customerId: "cus-07",
    issueDate: "2026-09-15", dueDate: "2026-10-15", status: "pending",
    items: [{ description: "Online store starter package", quantity: 1, unitPrice: 5400 }],
  },
  // Priya Sharma — pending
  {
    id: "inv-2043", number: "INV-2043", customerId: "cus-08",
    issueDate: "2026-09-16", dueDate: "2026-10-16", status: "pending",
    items: [{ description: "Inventory dashboard", quantity: 1, unitPrice: 11200 }],
  },
];
