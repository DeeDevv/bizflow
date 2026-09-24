"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Customer } from "./types";
import { seedCustomers } from "./mock-data";
import {
  createCustomerInDb,
  deleteCustomerInDb,
  loadCustomers,
  updateCustomerInDb,
} from "./customers-db";

/**
 * Customer store (Phase 5.6): the list lives in Supabase and is loaded
 * when the app starts; add/edit/delete write through to the database with
 * optimistic UI (rollback + error message on failure). The component-facing
 * API is unchanged from the localStorage version, so invoices, sales and
 * the dashboard keep working untouched.
 */

/** Customer as entered in the Add/Edit form. */
export type CustomerInput = Pick<Customer, "name" | "email" | "phone">;

export type CustomersStatus = "loading" | "ready" | "error";

interface CustomersStore {
  customers: Customer[];
  status: CustomersStatus;
  /** Last database error, shown by the page; null when everything is fine. */
  error: string | null;
  reload: () => void;
  clearError: () => void;
  addCustomer: (input: CustomerInput) => Promise<Customer | null>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<Customer | null>;
  deleteCustomer: (id: string) => Promise<boolean>;
}

const CustomersContext = createContext<CustomersStore | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [status, setStatus] = useState<CustomersStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the initial load ("Try again" after an error).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadCustomers().then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") {
        setCustomers(result.customers);
        setStatus("ready");
        setError(null);
      } else if (result.kind === "no-config") {
        // Demo mode without credentials: keep the mock data working.
        setCustomers(seedCustomers);
        setStatus("ready");
      } else if (result.kind === "no-business") {
        // Brand-new signup: no business registered yet — empty list.
        setCustomers([]);
        setStatus("ready");
        setError(null);
      } else {
        setStatus("error");
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const addCustomer = useCallback(
    async (input: CustomerInput): Promise<Customer | null> => {
      // Optimistic row so the UI feels instant; replaced by the saved row.
      const tempId = `temp-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const optimistic: Customer = { id: tempId, ...input };
      setCustomers((prev) => [optimistic, ...prev]);

      const result = await createCustomerInDb(input);
      if (result.kind === "ok" && result.customer) {
        const saved = result.customer;
        setCustomers((prev) => prev.map((c) => (c.id === tempId ? saved : c)));
        setError(null);
        return saved;
      }
      // Roll back and surface the error (message shown by the caller/page).
      setCustomers((prev) => prev.filter((c) => c.id !== tempId));
      if (result.kind === "error") setError(result.message);
      return null;
    },
    [],
  );

  const updateCustomer = useCallback(
    async (id: string, input: CustomerInput): Promise<Customer | null> => {
      const previous = customers.find((c) => c.id === id) ?? null;
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...input } : c)),
      );

      const result = await updateCustomerInDb(id, input);
      if (result.kind === "ok" && result.customer) {
        const saved = result.customer;
        setCustomers((prev) => prev.map((c) => (c.id === id ? saved : c)));
        setError(null);
        return saved;
      }
      if (previous) {
        setCustomers((prev) => prev.map((c) => (c.id === id ? previous : c)));
      }
      if (result.kind === "error") setError(result.message);
      return null;
    },
    [customers],
  );

  const deleteCustomer = useCallback(
    async (id: string): Promise<boolean> => {
      const previous = customers.find((c) => c.id === id) ?? null;
      setCustomers((prev) => prev.filter((c) => c.id !== id));

      const result = await deleteCustomerInDb(id);
      if (result.kind === "ok") {
        setError(null);
        return true;
      }
      if (previous) {
        setCustomers((prev) => [previous, ...prev]);
      }
      if (result.kind === "error") setError(result.message);
      return false;
    },
    [customers],
  );

  const value = useMemo(
    () => ({
      customers,
      status,
      error,
      reload,
      clearError,
      addCustomer,
      updateCustomer,
      deleteCustomer,
    }),
    [customers, status, error, reload, clearError, addCustomer, updateCustomer, deleteCustomer],
  );

  return (
    <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
  );
}

export function useCustomers(): CustomersStore {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
}
