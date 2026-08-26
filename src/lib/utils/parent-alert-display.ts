import type { GameIconName } from "@/components/game-icon";

/**
 * How one parent alert reads in the UI, keyed off `parentAlert.type`.
 *
 * The type column is a growing enum, so anything unrecognised falls back to a
 * neutral presentation rather than rendering a blank row: a new alert kind is
 * legible from the moment it's first written, before this map catches up.
 */
export type ParentAlertPresentation = {
  /** Completes the sentence `<hero> ___ "<quest>"`. */
  verb: string;
  /** One-word kind, shown as a chip on each row. */
  label: string;
  icon: GameIconName;
  /** Row accent. `warn` is the louder of the two. */
  tone: "warn" | "info";
};

const PRESENTATION: Record<string, ParentAlertPresentation> = {
  quest_skipped: { verb: "skipped", label: "Skipped", icon: "bellOff", tone: "info" },
  quest_stuck: { verb: "got stuck on", label: "Stuck", icon: "lock", tone: "warn" },
};

const FALLBACK: ParentAlertPresentation = {
  verb: "needs a grown-up on",
  label: "Alert",
  icon: "bell",
  tone: "warn",
};

export function alertPresentation(type: string): ParentAlertPresentation {
  return PRESENTATION[type] ?? FALLBACK;
}

/** `Robin got stuck on "Long division"` — the one line a parent has to read. */
export function alertHeadline(alert: {
  type: string;
  childName: string;
  questTitle: string;
}): string {
  return `${alert.childName} ${alertPresentation(alert.type).verb} "${alert.questTitle}"`;
}

/** Subject and date, whichever of them the alert actually carries. */
export function alertDetail(alert: { subjectName: string | null; date: string }): string {
  return [alert.subjectName, alert.date].filter(Boolean).join(" · ");
}

/**
 * What the bell says out loud to a screen reader. Zero is still announced —
 * the medallion is always mounted for a grown-up, so the label has to
 * distinguish "nothing to see" from "not loaded yet".
 */
export function bellLabel(count: number): string {
  if (count === 0) return "Alerts — nothing needs your attention";
  return `Alerts — ${count} ${count === 1 ? "alert needs" : "alerts need"} your attention`;
}
