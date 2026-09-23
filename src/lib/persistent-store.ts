"use client";

/**
 * Tiny localStorage-backed store factory shared by customers and invoices.
 * Same pattern as customers-store: useSyncExternalStore over localStorage,
 * cached snapshot, cross-tab sync. Swap the read/write functions for API
 * calls in a later phase.
 */

type Listener = () => void;

export interface PersistentStore<T> {
  get: () => T;
  subscribe: (listener: Listener) => () => void;
  set: (next: T) => void;
}

export function createPersistentStore<T>(key: string, seed: T): PersistentStore<T> {
  let cache: T = typeof window === "undefined" ? seed : readStorage();

  const listeners = new Set<Listener>();

  function readStorage(): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return seed;
      const parsed = JSON.parse(raw) as T;
      return parsed ?? seed;
    } catch {
      return seed;
    }
  }

  function get(): T {
    return cache;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function set(next: T) {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or unavailable — the demo still works in-memory
    }
    listeners.forEach((l) => l());
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) {
        cache = readStorage();
        listeners.forEach((l) => l());
      }
    });
  }

  return { get, subscribe, set };
}
