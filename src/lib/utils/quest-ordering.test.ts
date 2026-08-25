import { describe, it, expect } from "vitest";
import { earliestStartTimeByDayAndSubject, sortUpcomingBySchedule } from "./quest-ordering";

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
