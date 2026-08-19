import { describe, it, expect } from "vitest";
import { findBoundaryCrossings, type ScheduleBlockLite } from "./schedule-notifications";
import type { DayOfWeek } from "@/lib/utils/schedule-days";

// A Wednesday. Month is 0-indexed; 2026-08-19 is a Wednesday.
const WED_9_00 = new Date(2026, 7, 19, 9, 0);
const WED_9_29 = new Date(2026, 7, 19, 9, 29);
const WED_9_30 = new Date(2026, 7, 19, 9, 30);
const WED_10_15 = new Date(2026, 7, 19, 10, 15);
const THU_9_30 = new Date(2026, 7, 20, 9, 30);

const math: ScheduleBlockLite = {
  id: "block-1",
  subjectId: "subj-math",
  dayOfWeek: "wed",
  startTime: "09:30",
  endTime: "10:15",
};

const schoolDays: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri"];

describe("findBoundaryCrossings", () => {
  it("fires a start crossing when now reaches the block's start time", () => {
    const crossings = findBoundaryCrossings([math], schoolDays, WED_9_00, WED_9_30);
    expect(crossings).toEqual([{ block: math, kind: "start" }]);
  });

  it("fires an end crossing when now reaches the block's end time", () => {
    const wed_10_00 = new Date(2026, 7, 19, 10, 0);
    const crossings = findBoundaryCrossings([math], schoolDays, wed_10_00, WED_10_15);
    expect(crossings).toEqual([{ block: math, kind: "end" }]);
  });

  it("does not fire before the boundary is reached", () => {
    const crossings = findBoundaryCrossings([math], schoolDays, WED_9_00, WED_9_29);
    expect(crossings).toEqual([]);
  });

  it("does not fire again once already past the boundary (no re-fire on repeated polls)", () => {
    const crossings = findBoundaryCrossings([math], schoolDays, WED_9_30, new Date(2026, 7, 19, 9, 45));
    expect(crossings).toEqual([]);
  });

  it("does not fire for a non-school day even if the time matches", () => {
    const crossings = findBoundaryCrossings(
      [{ ...math, dayOfWeek: "thu" }],
      schoolDays.filter((d) => d !== "thu"),
      new Date(2026, 7, 20, 9, 0),
      THU_9_30
    );
    expect(crossings).toEqual([]);
  });

  it("does not backfill a block that already started before the first poll (prev === now)", () => {
    const crossings = findBoundaryCrossings([math], schoolDays, WED_9_30, WED_9_30);
    expect(crossings).toEqual([]);
  });

  it("does not fire across a gap spanning midnight into the next day", () => {
    const wedLate = new Date(2026, 7, 19, 23, 59);
    const crossings = findBoundaryCrossings([{ ...math, dayOfWeek: "thu" }], schoolDays, wedLate, THU_9_30);
    expect(crossings).toEqual([]);
  });
});
