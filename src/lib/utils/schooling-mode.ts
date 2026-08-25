import type { DayOfWeek } from "./schedule-days";

export type SchoolingMode = "structured" | "unstructured";

/** Parses the sparse per-day override JSON column, tolerant of malformed/legacy data. */
export function parseSchoolingModeOverrides(
  raw: string | null
): Partial<Record<DayOfWeek, SchoolingMode>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Partial<Record<DayOfWeek, SchoolingMode>> = {};
    for (const [day, mode] of Object.entries(parsed)) {
      if (mode === "structured" || mode === "unstructured") {
        out[day as DayOfWeek] = mode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Resolves the effective mode for a given weekday: an override wins, else the default. */
export function getEffectiveSchoolingMode(
  defaultMode: SchoolingMode,
  overrides: Partial<Record<DayOfWeek, SchoolingMode>>,
  day: DayOfWeek
): SchoolingMode {
  return overrides[day] ?? defaultMode;
}
