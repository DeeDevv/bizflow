"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { createPersistentStore } from "./persistent-store";
import type { EmployeeRole } from "./employee-roles";

/**
 * Setup store (Phase 2) — the entities the owner enters during guided setup
 * that have no backend yet: business type, owner profile, employees, and the
 * extended product fields (code/model, category, brand, cost price,
 * low-stock threshold, warranty, category details).
 *
 * Everything here persists to localStorage so a refresh mid-setup never loses
 * the owner's typing. When the new Supabase project arrives, these records
 * move into real tables and this store shrinks to a cache — the shapes below
 * are already API-like for that reason.
 *
 * The business row itself is NOT stored here: creation still goes through
 * the real saveBusiness path (SetupGate/wizard), keeping the existing
 * single-source-of-truth for the signed-in owner's business.
 */

const STORAGE_KEY = "bizmate.setup.v1";

/** An employee added during setup (mock/local until the backend exists). */
export interface Employee {
  id: string;
  name: string;
  /** Phone number and/or email — how they'll be invited later. */
  contact: string;
  role: EmployeeRole;
  /** "active" = created directly; "pending" = invitation queued (mock). */
  status: "active" | "pending";
}

/** The owner's own profile (the owner role is implied, never selected). */
export interface OwnerProfile {
  name: string;
  email: string;
  phone: string;
  /** Data-URL preview; optional. */
  photoUrl: string;
}

export const emptyOwner: OwnerProfile = { name: "", email: "", phone: "", photoUrl: "" };

/** Warranty info captured per product (optional, electronics-friendly). */
export interface WarrantyInfo {
  available: boolean;
  period: string;
  notes: string;
}

/** A product as entered during setup — everything BizMate needs up front. */
export interface SetupProduct {
  id: string;
  name: string;
  /** Manufacturer model number / product code, e.g. "AS12TG1". */
  code: string;
  /** Category label (from the catalog or the owner's own). */
  category: string;
  brand: string;
  sellingPrice: number;
  /** Optional — unlocks the profit preview; hidden from ordinary employees later. */
  costPrice: number | null;
  /** Starting quantity BizMate counts down from. */
  openingStock: number;
  /** Alert when stock falls to this level; 0 = no alert. */
  lowStockAt: number;
  warranty: WarrantyInfo;
  /** Category-specific details (capacity, power rating, …) — free-form for now. */
  details: Record<string, string>;
  imageUrl: string;
}

/** Extended product info kept alongside the core catalog record. */
export type ProductExtra = Omit<
  SetupProduct,
  "id" | "name" | "sellingPrice" | "openingStock" | "imageUrl"
>;

/** Business fields collected in step 1 — saved to the real business at completion. */
export interface BusinessDraft {
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
}

export const emptyBusinessDraft: BusinessDraft = {
  name: "",
  email: "",
  phone: "",
  address: "",
  currency: "NGN",
};

export interface SetupState {
  businessType: string;
  businessDraft: BusinessDraft;
  owner: OwnerProfile;
  employees: Employee[];
  products: SetupProduct[];
  /** Extended fields keyed by product name (survives the local→database id swap). */
  productExtras: Record<string, ProductExtra>;
  setupComplete: boolean;
}

const seed: SetupState = {
  businessType: "",
  businessDraft: emptyBusinessDraft,
  owner: emptyOwner,
  employees: [],
  products: [],
  productExtras: {},
  setupComplete: false,
};

const store = createPersistentStore<SetupState>(STORAGE_KEY, seed);

function getSnapshot(): SetupState {
  return store.get();
}

function getServerSnapshot(): SetupState {
  return seed;
}

interface SetupStore {
  setup: SetupState;
  setBusinessType: (value: string) => void;
  setBusinessDraft: (input: Partial<BusinessDraft>) => void;
  setOwner: (input: Partial<OwnerProfile>) => void;
  addEmployee: (employee: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, input: Omit<Employee, "id">) => void;
  removeEmployee: (id: string) => void;
  addProduct: (product: Omit<SetupProduct, "id">) => void;
  updateProduct: (id: string, input: Omit<SetupProduct, "id">) => void;
  removeProduct: (id: string) => void;
  /** Freeze product extras and mark setup complete. */
  completeSetup: () => void;
}

const SetupContext = createContext<SetupStore | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const setup = useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setBusinessType = useCallback((value: string) => {
    store.set({ ...store.get(), businessType: value });
  }, []);

  const setBusinessDraft = useCallback((input: Partial<BusinessDraft>) => {
    store.set({
      ...store.get(),
      businessDraft: { ...store.get().businessDraft, ...input },
    });
  }, []);

  const setOwner = useCallback((input: Partial<OwnerProfile>) => {
    store.set({ ...store.get(), owner: { ...store.get().owner, ...input } });
  }, []);

  const addEmployee = useCallback((employee: Omit<Employee, "id">) => {
    store.set({
      ...store.get(),
      employees: [...store.get().employees, { id: newId("emp"), ...employee }],
    });
  }, []);

  const updateEmployee = useCallback((id: string, input: Omit<Employee, "id">) => {
    store.set({
      ...store.get(),
      employees: store.get().employees.map((e) => (e.id === id ? { ...e, ...input } : e)),
    });
  }, []);

  const removeEmployee = useCallback((id: string) => {
    store.set({
      ...store.get(),
      employees: store.get().employees.filter((e) => e.id !== id),
    });
  }, []);

  const addProduct = useCallback((product: Omit<SetupProduct, "id">) => {
    store.set({
      ...store.get(),
      products: [...store.get().products, { id: newId("prd"), ...product }],
    });
  }, []);

  const updateProduct = useCallback((id: string, input: Omit<SetupProduct, "id">) => {
    store.set({
      ...store.get(),
      products: store.get().products.map((p) => (p.id === id ? { ...p, ...input } : p)),
    });
  }, []);

  const removeProduct = useCallback((id: string) => {
    store.set({
      ...store.get(),
      products: store.get().products.filter((p) => p.id !== id),
    });
  }, []);

  const completeSetup = useCallback(() => {
    const current = store.get();
    // Freeze the extended fields so they survive the products moving into
    // the real catalog (keyed by name — names are what the owner knows).
    const productExtras: Record<string, ProductExtra> = {};
    for (const p of current.products) {
      productExtras[p.name] = {
        code: p.code,
        category: p.category,
        brand: p.brand,
        costPrice: p.costPrice,
        lowStockAt: p.lowStockAt,
        warranty: p.warranty,
        details: p.details,
      };
    }
    store.set({ ...current, productExtras, setupComplete: true });
  }, []);

  const value = useMemo(
    () => ({
      setup,
      setBusinessType,
      setBusinessDraft,
      setOwner,
      addEmployee,
      updateEmployee,
      removeEmployee,
      addProduct,
      updateProduct,
      removeProduct,
      completeSetup,
    }),
    [
      setup,
      setBusinessType,
      setBusinessDraft,
      setOwner,
      addEmployee,
      updateEmployee,
      removeEmployee,
      addProduct,
      updateProduct,
      removeProduct,
      completeSetup,
    ],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupStore {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup must be used within SetupProvider");
  return ctx;
}
