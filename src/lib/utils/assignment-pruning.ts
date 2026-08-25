import { getScheduledDates } from "@/lib/utils/schedule";

export type PruneSchedule = {
  frequency: "once" | "daily" | "weekly" | "monthly";
  daysOfWeek: string | null; // JSON array, as stored
  intervalWeeks: number | null;
  startDate: string;
  endDate: string | null;
};

export type PendingAssignmentRow = {
  id: string;
  questId: string;
  date: string; // ISO YYYY-MM-DD
  questIsActive: boolean;
  /** The quest's schedule as it stands *now*, or null when the quest has none. */
  schedule: PruneSchedule | null;
};

/**
 * Decides which already-materialized `pending` assignments no longer belong to
 * the plan, so removing a quest — or its repeat — actually clears it out of
 * Today's Quests and Upcoming Quests instead of leaving orphan rows behind.
 *
 * Only `pending` rows should ever be handed in: completed/skipped assignments
 * are the child's history (the learning log reads them back) and must survive
 * a quest being retired.
 *
 * Three rules, in order:
 *  - The quest was removed (soft-deleted) → every pending row is stale.
 *  - The quest still has a schedule → a pending row is stale unless the
 *    schedule, as it reads today, still calls for that date. This is what
 *    prunes the leftovers when a repeat is narrowed (e.g. Mon/Wed → Tue) or
 *    given an end date.
 *  - The quest has no schedule → keep. Unscheduled quests are one-off/bonus
 *    quests whose assignments are created ad hoc by "Start a Quest", and
 *    those are never the scheduler's to delete. Callers that *just* deleted a
 *    schedule prune that quest's rows directly instead.
 */
export function findStaleAssignmentIds(
  rows: PendingAssignmentRow[],
  opts: { rangeStart: string; rangeEnd: string; schoolDays: string[] | null }
): string[] {
  const scheduledDatesByQuestId = new Map<string, Set<string>>();
  const stale: string[] = [];

  for (const row of rows) {
    if (!row.questIsActive) {
      stale.push(row.id);
      continue;
    }
    if (!row.schedule) continue;

    let dates = scheduledDatesByQuestId.get(row.questId);
    if (!dates) {
      dates = new Set(scheduledDatesForRange(row.schedule, opts));
      scheduledDatesByQuestId.set(row.questId, dates);
    }
    if (!dates.has(row.date)) stale.push(row.id);
  }

  return stale;
}

function scheduledDatesForRange(
  schedule: PruneSchedule,
  opts: { rangeStart: string; rangeEnd: string; schoolDays: string[] | null }
): string[] {
  const daysOfWeek = schedule.daysOfWeek ? (JSON.parse(schedule.daysOfWeek) as string[]) : null;
  return getScheduledDates(
    schedule.frequency,
    daysOfWeek,
    schedule.intervalWeeks,
    schedule.startDate,
    schedule.endDate,
    opts.rangeStart,
    opts.rangeEnd,
    opts.schoolDays
  );
}
