/**
 * BizMate domain events (Phase 4).
 *
 * Important business actions produce typed events; the automation engine
 * (automation.ts) processes them. Events are an internal architecture — they
 * do not become production messages until the new backend exists. Kept
 * dependency-free so any layer can emit them.
 */

/* ---------------- Sales ---------------- */

export interface SaleCompletedEvent {
  type: "SALE_COMPLETED";
  /** Stable transaction reference, e.g. "BM-1024" — idempotency key. */
  saleRef: string;
  employeeName: string;
  customerId: string | null;
  /** Sum of the sale (what the customer owes). */
  total: number;
  /** Money actually received with this sale. */
  amountPaid: number;
  paymentStatus: "paid" | "part" | "unpaid";
}

export interface SaleCancelledEvent {
  type: "SALE_CANCELLED";
  saleRef: string;
  employeeName: string;
  reason?: string;
}

/* ---------------- Payments ---------------- */

export interface PaymentRecordedEvent {
  type: "PAYMENT_RECORDED";
  saleRef: string;
  amount: number;
  /** Balance remaining on the transaction after this payment. */
  remainingBalance: number;
}

/* ---------------- Inventory ---------------- */

export interface StockDeductedEvent {
  type: "STOCK_DEDUCTED";
  productId: string;
  productName: string;
  quantity: number;
  /** Stock after the deduction. */
  newStock: number;
  saleRef: string;
}

export interface StockReceivedEvent {
  type: "STOCK_RECEIVED";
  productId: string;
  productName: string;
  quantity: number;
  newStock: number;
  employeeName: string;
}

export interface StockAdjustedEvent {
  type: "STOCK_ADJUSTED";
  productId: string;
  productName: string;
  /** Signed delta (negative = shrinkage). */
  delta: number;
  newStock: number;
  reason: "damaged" | "missing" | "correction" | "return" | "other";
  employeeName: string;
}

/* ---------------- Customers ---------------- */

export interface CustomerCreatedEvent {
  type: "CUSTOMER_CREATED";
  customerId: string;
  customerName: string;
  employeeName: string;
}

/* ---------------- Employees ---------------- */

export interface EmployeeEvent {
  type: "EMPLOYEE_CREATED" | "EMPLOYEE_UPDATED" | "EMPLOYEE_REMOVED";
  employeeName: string;
  actorName: string;
}

export type BizMateEvent =
  | SaleCompletedEvent
  | SaleCancelledEvent
  | PaymentRecordedEvent
  | StockDeductedEvent
  | StockReceivedEvent
  | StockAdjustedEvent
  | CustomerCreatedEvent
  | EmployeeEvent;

/** Human-readable one-liner for the activity log. */
export function describeEvent(event: BizMateEvent): string {
  switch (event.type) {
    case "SALE_COMPLETED":
      return `completed sale ${event.saleRef}`;
    case "SALE_CANCELLED":
      return `cancelled sale ${event.saleRef}`;
    case "PAYMENT_RECORDED":
      return `recorded payment for ${event.saleRef}`;
    case "STOCK_DEDUCTED":
      return `sold ${event.quantity} × ${event.productName}`;
    case "STOCK_RECEIVED":
      return `received ${event.quantity} × ${event.productName}`;
    case "STOCK_ADJUSTED":
      return `adjusted ${event.productName} (${event.delta > 0 ? "+" : ""}${event.delta})`;
    case "CUSTOMER_CREATED":
      return `added customer ${event.customerName}`;
    case "EMPLOYEE_CREATED":
      return `added employee ${event.employeeName}`;
    case "EMPLOYEE_UPDATED":
      return `updated employee ${event.employeeName}`;
    case "EMPLOYEE_REMOVED":
      return `removed employee ${event.employeeName}`;
  }
}
