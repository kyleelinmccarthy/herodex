"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameIcon } from "@/components/game-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { useParentAlerts } from "@/components/parent-alerts-context";
import {
  alertDetail,
  alertHeadline,
  alertPresentation,
  bellLabel,
} from "@/lib/utils/parent-alert-display";

/** Rows beyond this stay in the Tavern panel rather than making the tray scroll forever. */
const MAX_ROWS = 6;

/**
 * The grown-ups' standing alert surface: a nav medallion that is mounted on
 * every page and carries an unread count until each alert is actually
 * dismissed. The toast is the nudge; this is the thing that refuses to be
 * missed, because a parent looking at any screen can see whether something is
 * waiting without going to look for it.
 */
export function ParentAlertBell() {
  const { alerts, busy, dismiss, dismissAll } = useParentAlerts();
  // The route the tray was opened on, rather than a plain boolean: navigating
  // away (including via the tray's own "View" link) closes it for free, with
  // no effect racing the render that follows the navigation.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const count = alerts.length;
  const open = openedOn !== null && openedOn === pathname;
  const close = useCallback(() => setOpenedOn(null), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      // The tray is portalled out of the nav bar, so it is not inside wrapRef.
      if (wrapRef.current?.contains(target) || trayRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={wrapRef} className="relative">
      <Tooltip content="Alerts — what your heroes skipped or got stuck on.">
        <button
          type="button"
          onClick={() => setOpenedOn((prev) => (prev === pathname ? null : pathname))}
          aria-label={bellLabel(count)}
          aria-expanded={open}
          data-count={count}
          className={count > 0 ? "user-medallion alert-medallion alert-medallion--unread" : "user-medallion alert-medallion"}
        >
          <span className="medallion-icon relative" aria-hidden="true">
            <GameIcon name="bell" className="size-5 text-[var(--gold-bright)]" />
            {count > 0 && <span className="alert-medallion-badge">{count > 99 ? "99+" : count}</span>}
          </span>
          <span className="medallion-label">Alerts</span>
        </button>
      </Tooltip>

      {open &&
        createPortal(
          <div ref={trayRef} role="dialog" aria-label="Alerts" className="alert-tray">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--gold-border)]/40 px-3 py-2">
              <p className="text-sm font-semibold text-[var(--gold-bright)]">
                {count === 0 ? "Alerts" : `Alerts (${count})`}
              </p>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => dismissAll()}
                  disabled={busy}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Dismiss all
                </button>
              )}
            </div>

            {count === 0 ? (
              <div className="px-3 py-6 text-center">
                <GameIcon name="check" className="mx-auto size-6 text-[var(--gold-bright)]" />
                <p className="mt-2 text-sm text-muted-foreground">
                  All clear — nothing needs a grown-up.
                </p>
              </div>
            ) : (
              <ul className="max-h-[min(24rem,50svh)] overflow-y-auto py-1">
                {alerts.slice(0, MAX_ROWS).map((alert) => {
                  const presentation = alertPresentation(alert.type);
                  return (
                    <li
                      key={alert.id}
                      data-tone={presentation.tone}
                      className="alert-tray-row flex items-start gap-2 px-3 py-2"
                    >
                      <GameIcon
                        name={presentation.icon}
                        className="mt-0.5 size-4 shrink-0 text-[var(--gold-bright)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm wrap-anywhere text-foreground">{alertHeadline(alert)}</p>
                        <p className="text-xs text-muted-foreground">{alertDetail(alert)}</p>
                        {alert.note && (
                          <p className="mt-0.5 text-xs italic wrap-anywhere text-muted-foreground">
                            &ldquo;{alert.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismiss(alert.id)}
                        disabled={busy}
                        aria-label={`Dismiss: ${alertHeadline(alert)}`}
                        className="shrink-0 rounded px-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-[var(--gold-border)]/40 px-3 py-2 text-center">
              <Link href="/tavern" className="text-xs font-medium text-primary hover:underline">
                {count > MAX_ROWS ? `View all ${count} in the Tavern →` : "View in the Tavern →"}
              </Link>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
