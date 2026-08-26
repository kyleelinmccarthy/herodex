"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getParentAlerts,
  dismissParentAlert,
  dismissAllParentAlerts,
  type ParentAlert,
} from "@/lib/actions/parent-alerts";

const POLL_MS = 60_000;

type ParentAlertsValue = {
  alerts: ParentAlert[];
  busy: boolean;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
};

const EMPTY: ParentAlertsValue = {
  alerts: [],
  busy: false,
  dismiss: async () => {},
  dismissAll: async () => {},
};

const ParentAlertsContext = createContext<ParentAlertsValue | null>(null);

/**
 * Every grown-up-facing alert surface reads from here — the nav bell, the
 * toast, and the Tavern panel — so one poll feeds all three and they can never
 * disagree about the count. Seeded with the layout's server-rendered list, so
 * the bell carries its badge on first paint rather than popping in a second
 * later.
 *
 * Rendered for heroes too (the layout wraps the whole shell); `enabled` is
 * what keeps their session from polling an action that would only turn them
 * away.
 */
export function ParentAlertsProvider({
  initialAlerts,
  enabled,
  children,
}: {
  initialAlerts: ParentAlert[];
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [busy, setBusy] = useState(false);
  // Refreshes fire from a timer, from tab focus, and after each dismissal;
  // without this an in-flight poll from before a dismissal could land after it
  // and put the row straight back on screen.
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const mine = ++generation.current;
    let next: ParentAlert[];
    try {
      next = await getParentAlerts();
    } catch {
      return; // signed out, or no family yet — leave the list as it stands
    }
    if (mine !== generation.current) return;
    setAlerts(next);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(refresh, POLL_MS);
    // A parent who leaves the tab open all morning should find the bell
    // current the moment they come back to it, not up to a minute stale.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, refresh]);

  const dismiss = useCallback(
    async (id: string) => {
      setBusy(true);
      generation.current++;
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      try {
        await dismissParentAlert(id);
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [refresh]
  );

  const dismissAll = useCallback(async () => {
    setBusy(true);
    generation.current++;
    setAlerts([]);
    try {
      await dismissAllParentAlerts();
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ alerts, busy, dismiss, dismissAll }),
    [alerts, busy, dismiss, dismissAll]
  );

  return <ParentAlertsContext.Provider value={value}>{children}</ParentAlertsContext.Provider>;
}

/**
 * Falls back to an empty, inert list when there's no provider above — the nav
 * bar renders in isolation in tests, and heroes never get one.
 */
export function useParentAlerts(): ParentAlertsValue {
  return useContext(ParentAlertsContext) ?? EMPTY;
}
