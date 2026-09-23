"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Product } from "./types";
import { seedProducts } from "./mock-data";
import {
  createProductInDb,
  deleteProductInDb,
  loadProducts,
  updateProductInDb,
} from "./products-db";

/**
 * Product catalog store (Phase 5.5): the list lives in Supabase and is
 * loaded when the app starts; add/edit/delete write through to the
 * database with optimistic UI (rollback + error message on failure).
 * The component-facing API is unchanged from the localStorage version.
 */

/** Product as entered in the Add/Edit form. */
export type ProductInput = Omit<Product, "id">;

export type ProductsStatus = "loading" | "ready" | "error";

interface ProductsStore {
  products: Product[];
  status: ProductsStatus;
  /** Last database error, shown by the page; null when everything is fine. */
  error: string | null;
  reload: () => void;
  clearError: () => void;
  addProduct: (input: ProductInput) => Promise<Product | null>;
  updateProduct: (id: string, input: ProductInput) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
}

const ProductsContext = createContext<ProductsStore | null>(null);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<ProductsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the initial load ("Try again" after an error).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadProducts().then((result) => {
      if (cancelled) return;
      if (result.kind === "ok") {
        setProducts(result.products);
        setStatus("ready");
        setError(null);
      } else if (result.kind === "no-config") {
        // Demo mode without credentials: keep the mock catalog working.
        setProducts(seedProducts);
        setStatus("ready");
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

  const addProduct = useCallback(
    async (input: ProductInput): Promise<Product | null> => {
      // Optimistic row so the UI feels instant; replaced by the saved row.
      const tempId = `temp-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const optimistic: Product = { id: tempId, ...input };
      setProducts((prev) => [optimistic, ...prev]);

      const result = await createProductInDb(input);
      if (result.kind === "ok" && result.product) {
        const saved = result.product;
        setProducts((prev) =>
          prev.map((p) => (p.id === tempId ? saved : p)),
        );
        setError(null);
        return saved;
      }
      // Roll back and surface the error (message shown by the caller/page).
      setProducts((prev) => prev.filter((p) => p.id !== tempId));
      if (result.kind === "error") setError(result.message);
      return null;
    },
    [],
  );

  const updateProduct = useCallback(
    async (id: string, input: ProductInput): Promise<Product | null> => {
      const previous = products.find((p) => p.id === id) ?? null;
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...input } : p)),
      );

      const result = await updateProductInDb(id, input);
      if (result.kind === "ok" && result.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? result.product! : p)),
        );
        setError(null);
        return result.product;
      }
      if (previous) {
        setProducts((prev) => prev.map((p) => (p.id === id ? previous : p)));
      }
      if (result.kind === "error") setError(result.message);
      return null;
    },
    [products],
  );

  const deleteProduct = useCallback(
    async (id: string): Promise<boolean> => {
      const previous = products.find((p) => p.id === id) ?? null;
      setProducts((prev) => prev.filter((p) => p.id !== id));

      const result = await deleteProductInDb(id);
      if (result.kind === "ok") {
        setError(null);
        return true;
      }
      if (previous) {
        setProducts((prev) => [previous, ...prev]);
      }
      if (result.kind === "error") setError(result.message);
      return false;
    },
    [products],
  );

  const value = useMemo(
    () => ({
      products,
      status,
      error,
      reload,
      clearError,
      addProduct,
      updateProduct,
      deleteProduct,
    }),
    [products, status, error, reload, clearError, addProduct, updateProduct, deleteProduct],
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts(): ProductsStore {
  const ctx = useContext(ProductsContext);
  if (ctx) return ctx;
  throw new Error("useProducts must be used within ProductsProvider");
}
