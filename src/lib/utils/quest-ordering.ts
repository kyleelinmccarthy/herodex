export type OrderableQuest = {
  id: string;
  subjectId: string;
  hasSchedule: boolean;
  sortOrder: number;
};

export type ScheduleBlockLite = { subjectId: string; startTime: string; endTime: string };

export type TodayAssignmentLite = {
  assignment: { id: string; status: string };
  quest: { id: string };
};

export type LatestStatusMap = Record<string, { status: string; date: string }>;

export type BlockStatus = "current" | "upcoming" | "past" | "unscheduled";

/** Earliest scheduled block per subject today, so a subject scheduled twice still sorts/labels by its first occurrence. */
export function earliestBlockBySubject(blocks: ScheduleBlockLite[]): Map<string, ScheduleBlockLite> {
  const map = new Map<string, ScheduleBlockLite>();
  for (const block of blocks) {
    const existing = map.get(block.subjectId);
    if (!existing || block.startTime < existing.startTime) {
      map.set(block.subjectId, block);
    }
  }
  return map;
}

export function blockStatus(block: ScheduleBlockLite | undefined, nowTime: string | undefined): BlockStatus {
  if (!block || !nowTime) return "unscheduled";
  if (nowTime < block.startTime) return "upcoming";
  if (nowTime >= block.endTime) return "past";
  return "current";
}

/**
 * A quest already completed or skipped today shouldn't still be offered to start again.
 * Recurring quests only belong in the list on the days they're actually assigned;
 * quests with no recurring schedule are one-off/bonus quests that stay available
 * any day until completed or skipped (checked against their most recent
 * assignment ever, not just today's, so a one-off finished or skipped on a
 * previous day doesn't reappear).
 */
export function filterAvailableQuests<T extends OrderableQuest>(
  quests: T[],
  todayAssignments: TodayAssignmentLite[],
  latestStatusByQuestId: LatestStatusMap
): T[] {
  const todayStatusByQuestId = new Map(todayAssignments.map((a) => [a.quest.id, a.assignment.status]));
  const assignedTodayQuestIds = new Set(todayAssignments.map((a) => a.quest.id));
  return quests.filter((q) => {
    const todayStatus = todayStatusByQuestId.get(q.id);
    if (todayStatus === "completed" || todayStatus === "skipped") return false;
    if (assignedTodayQuestIds.has(q.id)) return true;
    if (q.hasSchedule) return false;
    const latestStatus = latestStatusByQuestId[q.id]?.status;
    return latestStatus !== "completed" && latestStatus !== "skipped";
  });
}

/** Sorts after every real "HH:mm", so unscheduled items trail that day's scheduled ones. */
const UNSCHEDULED_START = "99:99";

const STATUS_RANK: Record<BlockStatus, number> = { current: 0, upcoming: 1, past: 2, unscheduled: 3 };

/**
 * Serves up what's scheduled right now first, then what's coming up today, then
 * anything already past, then anything with no schedule slot at all — so a hero
 * sees what to do next instead of hunting through the full list. Ties are broken
 * by scheduled start time, then by the quest's own sortOrder (a stable DB column,
 * not array position — this must stay deterministic across both the client's and
 * the server's independently-fetched quest lists).
 */
export function sortQuestsBySchedule<T extends OrderableQuest>(
  quests: T[],
  blockBySubjectId: Map<string, ScheduleBlockLite>,
  nowTime: string | undefined
): T[] {
  return [...quests].sort((a, b) => {
    const blockA = blockBySubjectId.get(a.subjectId);
    const blockB = blockBySubjectId.get(b.subjectId);
    const rankDiff = STATUS_RANK[blockStatus(blockA, nowTime)] - STATUS_RANK[blockStatus(blockB, nowTime)];
    if (rankDiff !== 0) return rankDiff;
    if (blockA && blockB && blockA.startTime !== blockB.startTime) {
      return blockA.startTime.localeCompare(blockB.startTime);
    }
    return a.sortOrder - b.sortOrder;
  });
}

/** Available quests today, in display/priority order. */
export function getOrderedAvailableQuests<T extends OrderableQuest>(params: {
  quests: T[];
  todayAssignments: TodayAssignmentLite[];
  latestStatusByQuestId: LatestStatusMap;
  todaysBlocks: ScheduleBlockLite[];
  nowTime: string | undefined;
}): T[] {
  const available = filterAvailableQuests(params.quests, params.todayAssignments, params.latestStatusByQuestId);
  const blockBySubjectId = earliestBlockBySubject(params.todaysBlocks);
  return sortQuestsBySchedule(available, blockBySubjectId, params.nowTime);
}

/**
 * Walks the day in plain schedule order — earliest scheduled start first,
 * unscheduled quests last — deliberately WITHOUT consulting the clock.
 * Two reasons it must not rank by "now" the way sortQuestsBySchedule does:
 * a quest missed this morning stays the next thing to do (heroes catch up on
 * what they fell behind on before moving ahead), and, since the order never
 * shifts as the day passes, the browser and the server always agree on which
 * quest is unlocked. Clock-ranking made them disagree — the server rejected
 * the very quest the page had just presented as startable.
 */
export function sortQuestsByScheduleTime<T extends OrderableQuest>(
  quests: T[],
  blockBySubjectId: Map<string, ScheduleBlockLite>
): T[] {
  return [...quests].sort((a, b) => {
    const startA = blockBySubjectId.get(a.subjectId)?.startTime ?? UNSCHEDULED_START;
    const startB = blockBySubjectId.get(b.subjectId)?.startTime ?? UNSCHEDULED_START;
    return startA.localeCompare(startB) || a.sortOrder - b.sortOrder;
  });
}

export type StructuredQueueParams<T extends OrderableQuest> = {
  quests: T[];
  todayAssignments: TodayAssignmentLite[];
  latestStatusByQuestId: LatestStatusMap;
  todaysBlocks: ScheduleBlockLite[];
};

/** Structured mode's queue for today: index 0 is the only quest a hero may start or complete. */
export function getStructuredQuestQueue<T extends OrderableQuest>(
  params: StructuredQueueParams<T>
): T[] {
  const available = filterAvailableQuests(params.quests, params.todayAssignments, params.latestStatusByQuestId);
  return sortQuestsByScheduleTime(available, earliestBlockBySubject(params.todaysBlocks));
}

/**
 * What Today's Quests needs to lock its cards: the one quest a hero may act
 * on, or null when the lock doesn't apply (a parent is looking, or the day is
 * unstructured). Shared so the tavern and the quest log always agree with each
 * other and with the server's own gate.
 */
export function getStructuredCardLock<T extends OrderableQuest & { title: string }>(
  params: StructuredQueueParams<T> & { enabled: boolean }
): { id: string; title: string } | null {
  if (!params.enabled) return null;
  const next = getNextStructuredQuest(params);
  return next ? { id: next.id, title: next.title } : null;
}

/** Structured mode's "next" quest: the first not-yet-completed item in schedule order, or null if none remain. */
export function getNextStructuredQuest<T extends OrderableQuest>(
  params: StructuredQueueParams<T>
): T | null {
  return getStructuredQuestQueue(params)[0] ?? null;
}

export type WeeklyBlockLite = { dayOfWeek: string; subjectId: string; startTime: string };

/** Earliest start time per (weekday, subject) across a child's whole weekly schedule, keyed `"day|subjectId"`. */
export function earliestStartTimeByDayAndSubject(blocks: WeeklyBlockLite[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of blocks) {
    const key = `${block.dayOfWeek}|${block.subjectId}`;
    const existing = map.get(key);
    if (!existing || block.startTime < existing) map.set(key, block.startTime);
  }
  return map;
}

export type UpcomingItemLite = { date: string; sortOrder: number };

/**
 * Chronological order across the whole family: by date, then by the subject's
 * scheduled start time that day, so two heroes' mornings interleave instead of
 * listing one hero's entire week before the next hero's. Ties fall back to the
 * quest's own sortOrder, then to the incoming order (a stable, deterministic
 * tiebreak rather than array-position luck from the sort itself).
 */
export function sortUpcomingBySchedule<T extends UpcomingItemLite>(
  items: T[],
  startTimeFor: (item: T) => string | undefined
): T[] {
  return items
    .map((item, index) => ({ item, index, startTime: startTimeFor(item) ?? UNSCHEDULED_START }))
    .sort(
      (a, b) =>
        a.item.date.localeCompare(b.item.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.item.sortOrder - b.item.sortOrder ||
        a.index - b.index
    )
    .map((entry) => entry.item);
}
