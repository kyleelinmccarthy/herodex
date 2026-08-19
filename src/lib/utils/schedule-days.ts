export const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// Date.getUTCDay() is 0-indexed starting on Sunday, unlike DAYS_OF_WEEK above.
const JS_DAY_ORDER: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** True when two "HH:mm" time ranges (half-open, [start, end)) overlap. */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** The weekday code for an ISO "YYYY-MM-DD" date. */
export function weekdayOfDate(isoDate: string): DayOfWeek {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return JS_DAY_ORDER[d.getUTCDay()];
}

/** Adds (or subtracts, if negative) whole days to an ISO "YYYY-MM-DD" date. */
export function addDaysToDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The default weekly repeat days for a fresh schedule: just the start date's weekday, if it's a school day. */
export function defaultRepeatDaysForStartDate(startDate: string, schoolDays: string[]): DayOfWeek[] {
  const wd = weekdayOfDate(startDate);
  return schoolDays.includes(wd) ? [wd] : [];
}

/** Ensures the start date's weekday is included in a weekly repeat's selected days, without dropping any other selection. */
export function syncRepeatDaysWithStartDate(
  days: string[],
  startDate: string,
  schoolDays: string[]
): string[] {
  const wd = weekdayOfDate(startDate);
  if (!schoolDays.includes(wd)) return days;
  return days.includes(wd) ? days : [...days, wd];
}
