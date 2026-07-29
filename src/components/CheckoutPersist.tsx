'use client';

import { useEffect } from 'react';

/**
 * Persiste o estado parcial do checkout em localStorage.
 * Use dentro do CheckoutFlow para que abandono seja recuperável.
 */

const KEY = 'meuloteamento:checkout:state';
const TTL_MS = 60 * 60 * 1000; // 1 hora

interface SavedState<T> {
  v: number;
  saved: number;
  data: T;
}

export function useCheckoutPersist<T>(state: T, version = 1) {
  useEffect(() => {
    try {
      const payload: SavedState<T> = { v: version, saved: Date.now(), data: state };
      window.localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
      // localStorage indisponivel
    }
  }, [state, version]);
}

export function loadCheckoutPersist<T>(version = 1): T | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState<T>;
    if (parsed.v !== version) return null;
    if (Date.now() - parsed.saved > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearCheckoutPersist() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export default function CheckoutPersist({ state }: { state: Record<string, unknown> }) {
  useCheckoutPersist(state);
  return null;
}
