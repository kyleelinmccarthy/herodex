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

/** Structured mode's "next" quest: the first not-yet-completed item in schedule order, or null if none remain. */
export function getNextStructuredQuest<T extends OrderableQuest>(
  params: Parameters<typeof getOrderedAvailableQuests<T>>[0]
): T | null {
  return getOrderedAvailableQuests(params)[0] ?? null;
}
