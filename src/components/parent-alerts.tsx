"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import {
  getParentAlerts,
  dismissParentAlert,
  dismissAllParentAlerts,
  type ParentAlert,
} from "@/lib/actions/parent-alerts";

const POLL_MS = 60_000;
const AUTO_DISMISS_MS = 10_000;
const MAX_TOASTS_AT_ONCE = 3;
const SEEN_KEY = "parent-alerts-seen";

function alertHeadline(alert: ParentAlert): string {
  return `${alert.childName} skipped "${alert.questTitle}"`;
}

function alertDetail(alert: ParentAlert): string {
  const parts = [alert.subjectName, alert.date].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The grown-ups' alert list on the family dashboard. Server-rendered from
 * `initialAlerts` so it's there on first paint, then kept in step by the
 * dismiss actions.
 */
export function ParentAlertsPanel({ initialAlerts }: { initialAlerts: ParentAlert[] }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [busy, setBusy] = useState(false);

  // The dashboard re-renders on refresh (and on navigation back to it), so
  // take the server's list as the truth whenever it changes underneath us.
  useEffect(() => {
    setAlerts(initialAlerts);
  }, [initialAlerts]);

  async function handleDismiss(id: string) {
    setBusy(true);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await dismissParentAlert(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDismissAll() {
    setBusy(true);
    setAlerts([]);
    try {
      await dismissAllParentAlerts();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (alerts.length === 0) return null;

  return (
    <GameFrame
      title="Alerts"
      icon={<GameIcon name="bell" className="size-4 text-[var(--gold-bright)]" />}
      action={
        <button
          type="button"
          onClick={handleDismissAll}
          disabled={busy}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          Dismiss all
        </button>
      }
    >
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 rounded-md border border-[var(--gold-border)]/40 bg-muted/20 px-3 py-2"
          >
            <GameIcon name="bell" className="mt-0.5 size-4 shrink-0 text-[var(--gold-bright)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm wrap-anywhere">
                <span className="font-medium">{alert.childName}</span> skipped{" "}
                <span className="font-medium">&quot;{alert.questTitle}&quot;</span>
              </p>
              <p className="text-xs text-muted-foreground">{alertDetail(alert)}</p>
              {alert.note && (
                <p className="mt-0.5 text-xs italic wrap-anywhere text-muted-foreground">
                  &ldquo;{alert.note}&rdquo;
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDismiss(alert.id)}
              disabled={busy}
              className="shrink-0"
            >
              Dismiss
            </Button>
          </div>
        ))}
      </div>
    </GameFrame>
  );
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    // Only the most recent ids are worth keeping — an alert that old has long
    // since been dismissed, and the list shouldn't grow forever.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    /* localStorage unavailable — a toast may repeat on the next page load */
  }
}

/**
 * Floating alert for the grown-ups, rendered app-wide so a skip surfaces
 * wherever a parent happens to be rather than only on the dashboard. Each
 * alert toasts once per browser (ids are remembered in localStorage); the
 * dashboard panel is what keeps them until they're actually dealt with.
 */
export function ParentAlertPopup() {
  const [toasts, setToasts] = useState<ParentAlert[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    seenRef.current = loadSeen();

    async function check() {
      let alerts: ParentAlert[];
      try {
        alerts = await getParentAlerts();
      } catch {
        return; // signed out, or no family yet — nothing to announce
      }
      if (cancelled) return;
      const fresh = alerts.filter((a) => !seenRef.current.has(a.id));
      if (fresh.length === 0) return;
      fresh.forEach((a) => seenRef.current.add(a.id));
      saveSeen(seenRef.current);
      setToasts((prev) => [...prev, ...fresh.slice(0, MAX_TOASTS_AT_ONCE)]);
    }

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed left-4 top-4 z-50 flex max-w-[min(20rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-2 rounded-xl border-2 border-[var(--gold-border)] bg-[linear-gradient(180deg,rgba(17,26,46,0.97)_0%,rgba(10,16,30,1)_100%)] px-4 py-3 shadow-[0_0_40px_-10px_rgba(201,168,76,0.2),0_8px_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-left-4"
        >
          <GameIcon name="bell" className="mt-0.5 size-4 shrink-0 text-[var(--gold-bright)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm wrap-anywhere text-foreground">{alertHeadline(toast)}</p>
            {toast.note && (
              <p className="text-xs italic wrap-anywhere text-muted-foreground">
                &ldquo;{toast.note}&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== toast.id))}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
