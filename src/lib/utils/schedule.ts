const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Computes which ISO date strings (YYYY-MM-DD) within [rangeStart, rangeEnd]
 * match a recurrence pattern, respecting the schedule's own start/end bounds.
 */
export function getScheduledDates(
  frequency: "daily" | "specific_days",
  daysOfWeek: string[] | null,
  startDate: string,
  endDate: string | null,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const effectiveStart = startDate > rangeStart ? startDate : rangeStart;
  const effectiveEnd = endDate && endDate < rangeEnd ? endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) return [];

  const daySet =
    frequency === "specific_days" && daysOfWeek?.length
      ? new Set(daysOfWeek)
      : null;

  if (frequency === "specific_days" && !daySet) return [];

  const results: string[] = [];
  let current = effectiveStart;

  while (current <= effectiveEnd) {
    if (frequency === "daily" || matchesDay(current, daySet!)) {
      results.push(current);
    }
    current = nextDay(current);
  }

  return results;
}

function matchesDay(isoDate: string, daySet: Set<string>): boolean {
  const d = new Date(isoDate + "T00:00:00");
  return daySet.has(DAY_NAMES[d.getUTCDay()]);
}

function nextDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
