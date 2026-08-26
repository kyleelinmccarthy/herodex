"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Remembers that a parent has cleared a derived notice — one computed from live
 * data rather than stored as a row, so there's nothing on the server to mark
 * read.
 *
 * What's remembered is a *signature* of what was dismissed, not a plain "hide
 * this" flag: when the underlying situation changes the signature changes with
 * it and the notice comes back on its own, which is the whole point of a
 * warning. Dismissal is per-browser.
 *
 * Built on useSyncExternalStore rather than an effect so the stored value is
 * read during render (no setState-in-effect, no cascading render) and so two
 * tabs stay in step via the storage event. `undefined` means "not known yet" —
 * the server and the hydrating client both see it, which lets a caller avoid
 * flashing up a notice that turns out to be dismissed.
 */
export function useDismissedNotice(storageKey: string) {
  const dismissed = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => read(storageKey),
    () => undefined
  );

  const dismiss = useCallback(
    (signature: string) => {
      write(storageKey, signature);
    },
    [storageKey]
  );

  return { dismissed, dismiss };
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Returns a primitive, so useSyncExternalStore compares snapshots by value without a cache. */
function read(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    // Storage can be unavailable outright (private mode, blocked site data).
    // Nothing dismissed is the safe answer: the notice shows.
    return null;
  }
}

function write(storageKey: string, signature: string) {
  try {
    localStorage.setItem(storageKey, signature);
  } catch {
    // Can't persist it, but still hide it for this render pass.
  }
  listeners.forEach((fn) => fn());
}
