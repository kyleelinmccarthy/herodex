import { DAYS_OF_WEEK, type DayOfWeek } from "@/lib/utils/schedule-days";

export type ScheduleBlockLite = {
  id: string;
  subjectId: string;
  dayOfWeek: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
};

export type ScheduleCrossing = {
  block: ScheduleBlockLite;
  kind: "start" | "end";
};

function dayOfWeekFor(date: Date): DayOfWeek {
  // getDay(): 0 = Sunday .. 6 = Saturday; DAYS_OF_WEEK starts at Monday.
  return DAYS_OF_WEEK[(date.getDay() + 6) % 7];
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Finds subject blocks whose start or end time falls strictly after `prev`
 * and at-or-before `now`, on `now`'s calendar day. Used to fire a
 * notification exactly once per boundary as a polling interval ticks
 * forward — never on the first tick after mount (prev === now).
 */
export function findBoundaryCrossings(
  blocks: ScheduleBlockLite[],
  schoolDays: DayOfWeek[],
  prev: Date,
  now: Date
): ScheduleCrossing[] {
  if (prev.getTime() >= now.getTime()) return [];
  // Only handles crossings within the same calendar day; a poll gap spanning
  // midnight simply misses stale boundaries from the prior day, which is the
  // desired behavior (no backfilling).
  if (prev.toDateString() !== now.toDateString()) return [];

  const today = dayOfWeekFor(now);
  if (!schoolDays.includes(today)) return [];

  const prevHhmm = hhmm(prev);
  const nowHhmm = hhmm(now);

  const crossings: ScheduleCrossing[] = [];
  for (const block of blocks) {
    if (block.dayOfWeek !== today) continue;
    if (block.startTime > prevHhmm && block.startTime <= nowHhmm) {
      crossings.push({ block, kind: "start" });
    }
    if (block.endTime > prevHhmm && block.endTime <= nowHhmm) {
      crossings.push({ block, kind: "end" });
    }
  }
  return crossings;
}
