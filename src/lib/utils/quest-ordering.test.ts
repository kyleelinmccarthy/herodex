import { describe, it, expect } from "vitest";
import {
  earliestStartTimeByDayAndSubject,
  getStructuredCardLock,
  getStructuredQuestQueue,
  sortUpcomingBySchedule,
} from "./quest-ordering";

describe("earliestStartTimeByDayAndSubject", () => {
  it("keys by weekday and subject, keeping the earliest of repeated blocks", () => {
    const map = earliestStartTimeByDayAndSubject([
      { dayOfWeek: "mon", subjectId: "math", startTime: "13:00" },
      { dayOfWeek: "mon", subjectId: "math", startTime: "09:00" },
      { dayOfWeek: "tue", subjectId: "math", startTime: "11:00" },
    ]);
    expect(map.get("mon|math")).toBe("09:00");
    expect(map.get("tue|math")).toBe("11:00");
    expect(map.get("wed|math")).toBeUndefined();
  });
});

describe("sortUpcomingBySchedule", () => {
  const startTimes: Record<string, string> = {
    "lily-reading": "08:00",
    "lucas-reading": "08:30",
    "lily-math": "10:00",
    "lucas-math": "09:30",
  };
  const item = (key: string, date: string, sortOrder = 0) => ({ key, date, sortOrder });
  const sort = (items: ReturnType<typeof item>[]) =>
    sortUpcomingBySchedule(items, (i) => startTimes[i.key]).map((i) => `${i.date} ${i.key}`);

  it("interleaves children by scheduled start time within each day", () => {
    expect(
      sort([
        item("lily-reading", "2026-08-25"),
        item("lily-math", "2026-08-25"),
        item("lucas-reading", "2026-08-25"),
        item("lucas-math", "2026-08-25"),
      ])
    ).toEqual([
      "2026-08-25 lily-reading",
      "2026-08-25 lucas-reading",
      "2026-08-25 lucas-math",
      "2026-08-25 lily-math",
    ]);
  });

  it("sorts by date before time", () => {
    expect(sort([item("lily-math", "2026-08-25"), item("lucas-reading", "2026-08-26")])).toEqual([
      "2026-08-25 lily-math",
      "2026-08-26 lucas-reading",
    ]);
  });

  it("puts unscheduled quests after that day's scheduled ones", () => {
    expect(sort([item("bonus", "2026-08-25"), item("lily-math", "2026-08-25")])).toEqual([
      "2026-08-25 lily-math",
      "2026-08-25 bonus",
    ]);
  });

  it("breaks ties on sortOrder, then on incoming order", () => {
    expect(
      sort([
        item("bonus", "2026-08-25", 2),
        item("chores", "2026-08-25", 1),
        item("recess", "2026-08-25", 1),
      ])
    ).toEqual(["2026-08-25 chores", "2026-08-25 recess", "2026-08-25 bonus"]);
  });
});

describe("getStructuredQuestQueue", () => {
  const quest = (id: string, subjectId: string, sortOrder = 0) => ({
    id,
    title: id,
    subjectId,
    hasSchedule: true,
    sortOrder,
  });
  const blocks = [
    { subjectId: "math", startTime: "08:00", endTime: "09:00" },
    { subjectId: "reading", startTime: "10:00", endTime: "11:00" },
  ];
  const assigned = (questId: string, status = "pending") => ({
    assignment: { id: `a-${questId}`, status },
    quest: { id: questId },
  });

  const queue = (todayAssignments: ReturnType<typeof assigned>[]) =>
    getStructuredQuestQueue({
      quests: [quest("reading", "reading"), quest("math", "math"), quest("bonus", "art", 5)],
      todayAssignments,
      latestStatusByQuestId: {},
      todaysBlocks: blocks,
    }).map((q) => q.id);

  it("orders by scheduled start time, with unscheduled quests last", () => {
    expect(queue([assigned("math"), assigned("reading"), assigned("bonus")])).toEqual([
      "math",
      "reading",
      "bonus",
    ]);
  });

  it("keeps a missed earlier quest at the head of the queue, whatever time it is", () => {
    // The 08:00 math block is long past, but it is still the next thing to
    // finish — the hero catches up before moving on to the 10:00 reading.
    expect(queue([assigned("math"), assigned("reading")])[0]).toBe("math");
  });

  it("moves on once the earlier quest is finished", () => {
    expect(queue([assigned("math", "completed"), assigned("reading")])).toEqual(["reading"]);
    expect(queue([assigned("math", "skipped"), assigned("reading")])).toEqual(["reading"]);
  });

  it("moves on when a hero gets stuck, so a hard quest can't strand the day", () => {
    expect(queue([assigned("math", "stuck"), assigned("reading")])).toEqual(["reading"]);
  });

  it("does not re-offer a one-off quest the hero got stuck on another day", () => {
    expect(
      getStructuredQuestQueue({
        quests: [{ id: "bonus", title: "bonus", subjectId: "art", hasSchedule: false, sortOrder: 0 }],
        todayAssignments: [],
        latestStatusByQuestId: { bonus: { status: "stuck", date: "2026-08-25" } },
        todaysBlocks: blocks,
      })
    ).toEqual([]);
  });
});

describe("getStructuredCardLock", () => {
  const params = {
    quests: [
      { id: "math", title: "Math Drills", subjectId: "math", hasSchedule: true, sortOrder: 0 },
      { id: "reading", title: "Reading", subjectId: "reading", hasSchedule: true, sortOrder: 1 },
    ],
    todayAssignments: [
      { assignment: { id: "a1", status: "pending" }, quest: { id: "math" } },
      { assignment: { id: "a2", status: "pending" }, quest: { id: "reading" } },
    ],
    latestStatusByQuestId: {},
    todaysBlocks: [
      { subjectId: "math", startTime: "08:00", endTime: "09:00" },
      { subjectId: "reading", startTime: "10:00", endTime: "11:00" },
    ],
  };

  it("names the only quest a hero may act on", () => {
    expect(getStructuredCardLock({ ...params, enabled: true })).toEqual({
      id: "math",
      title: "Math Drills",
    });
  });

  it("does not lock anything when disabled (a parent, or an unstructured day)", () => {
    expect(getStructuredCardLock({ ...params, enabled: false })).toBeNull();
  });

  it("does not lock anything once every quest is done", () => {
    expect(
      getStructuredCardLock({
        ...params,
        todayAssignments: params.todayAssignments.map((a) => ({
          ...a,
          assignment: { ...a.assignment, status: "completed" },
        })),
        enabled: true,
      })
    ).toBeNull();
  });
});
