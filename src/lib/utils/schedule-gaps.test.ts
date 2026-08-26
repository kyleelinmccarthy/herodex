import { describe, it, expect } from "vitest";
import {
  buildBlockDaysBySubject,
  findMissingScheduleDays,
  findSubjectScheduleGaps,
  formatDayList,
  scheduledWeekdays,
} from "./schedule-gaps";

const SCHOOL_DAYS = ["mon", "tue", "wed", "thu", "fri"];

// 2026-08-24 is a Monday.
const MONDAY = "2026-08-24";
const TUESDAY = "2026-08-25";

describe("scheduledWeekdays", () => {
  it("returns the selected days for a weekly repeat", () => {
    expect(
      scheduledWeekdays(
        { frequency: "weekly", daysOfWeek: ["wed", "mon"], intervalWeeks: 1, startDate: MONDAY, endDate: null },
        SCHOOL_DAYS
      )
    ).toEqual(["mon", "wed"]);
  });

  it("accepts daysOfWeek as the JSON string it is stored as", () => {
    expect(
      scheduledWeekdays(
        { frequency: "weekly", daysOfWeek: '["fri"]', intervalWeeks: 1, startDate: MONDAY, endDate: null },
        SCHOOL_DAYS
      )
    ).toEqual(["fri"]);
  });

  it("returns every school day for a daily repeat", () => {
    expect(
      scheduledWeekdays(
        { frequency: "daily", daysOfWeek: null, intervalWeeks: null, startDate: MONDAY, endDate: null },
        ["mon", "wed", "fri"]
      )
    ).toEqual(["mon", "wed", "fri"]);
  });

  it("returns just the chosen date's weekday for a one-off", () => {
    expect(
      scheduledWeekdays(
        { frequency: "once", daysOfWeek: null, intervalWeeks: null, startDate: TUESDAY, endDate: null },
        SCHOOL_DAYS
      )
    ).toEqual(["tue"]);
  });

  it("finds the several weekdays a monthly repeat drifts across", () => {
    const days = scheduledWeekdays(
      { frequency: "monthly", daysOfWeek: null, intervalWeeks: null, startDate: MONDAY, endDate: null },
      SCHOOL_DAYS
    );
    expect(days).toContain("mon");
    expect(days.length).toBeGreaterThan(1);
  });

  it("stops at the repeat's own end date", () => {
    expect(
      scheduledWeekdays(
        { frequency: "weekly", daysOfWeek: ["mon", "fri"], intervalWeeks: 1, startDate: MONDAY, endDate: "2026-08-26" },
        SCHOOL_DAYS
      )
    ).toEqual(["mon"]);
  });
});

describe("findMissingScheduleDays", () => {
  it("is empty when every scheduled day has a class block", () => {
    expect(
      findMissingScheduleDays({
        repeat: { frequency: "weekly", daysOfWeek: ["mon", "wed"], intervalWeeks: 1, startDate: MONDAY, endDate: null },
        subjectBlockDays: ["mon", "wed", "fri"],
        schoolDays: SCHOOL_DAYS,
      })
    ).toEqual([]);
  });

  it("names only the days the subject has no class time on", () => {
    expect(
      findMissingScheduleDays({
        repeat: { frequency: "weekly", daysOfWeek: ["mon", "wed", "fri"], intervalWeeks: 1, startDate: MONDAY, endDate: null },
        subjectBlockDays: ["mon"],
        schoolDays: SCHOOL_DAYS,
      })
    ).toEqual(["wed", "fri"]);
  });

  it("flags every day when the subject is not on the schedule at all", () => {
    expect(
      findMissingScheduleDays({
        repeat: { frequency: "weekly", daysOfWeek: ["tue"], intervalWeeks: 1, startDate: MONDAY, endDate: null },
        subjectBlockDays: [],
        schoolDays: SCHOOL_DAYS,
      })
    ).toEqual(["tue"]);
  });
});

describe("findSubjectScheduleGaps", () => {
  const blocks = [
    { subjectId: "math", dayOfWeek: "mon" },
    { subjectId: "math", dayOfWeek: "wed" },
  ];

  function questFor(id: string, subjectId: string, subjectName: string, days: string[]) {
    return {
      id,
      title: `Quest ${id}`,
      subjectId,
      subjectName,
      repeat: { frequency: "weekly", daysOfWeek: days, intervalWeeks: 1, startDate: MONDAY, endDate: null },
    };
  }

  it("reports nothing when every quest lands on a taught day", () => {
    expect(
      findSubjectScheduleGaps({
        quests: [questFor("a", "math", "Math", ["mon"])],
        blocks,
        schoolDays: SCHOOL_DAYS,
      })
    ).toEqual([]);
  });

  it("merges two quests on the same subject into one entry", () => {
    const gaps = findSubjectScheduleGaps({
      quests: [questFor("a", "art", "Art", ["tue"]), questFor("b", "art", "Art", ["fri"])],
      blocks,
      schoolDays: SCHOOL_DAYS,
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].missingDays).toEqual(["tue", "fri"]);
    expect(gaps[0].questTitles).toEqual(["Quest a", "Quest b"]);
    expect(gaps[0].neverScheduled).toBe(true);
  });

  it("marks a subject that is taught, just not on the quest's day", () => {
    const gaps = findSubjectScheduleGaps({
      quests: [questFor("a", "math", "Math", ["fri"])],
      blocks,
      schoolDays: SCHOOL_DAYS,
    });
    expect(gaps[0].missingDays).toEqual(["fri"]);
    expect(gaps[0].neverScheduled).toBe(false);
  });

  it("sorts entries by subject name", () => {
    const gaps = findSubjectScheduleGaps({
      quests: [questFor("a", "zoo", "Zoology", ["tue"]), questFor("b", "art", "Art", ["tue"])],
      blocks,
      schoolDays: SCHOOL_DAYS,
    });
    expect(gaps.map((g) => g.subjectName)).toEqual(["Art", "Zoology"]);
  });
});

describe("buildBlockDaysBySubject", () => {
  it("collapses repeated days and keeps calendar order", () => {
    expect(
      buildBlockDaysBySubject([
        { subjectId: "math", dayOfWeek: "wed" },
        { subjectId: "math", dayOfWeek: "mon" },
        { subjectId: "math", dayOfWeek: "mon" },
      ])
    ).toEqual({ math: ["mon", "wed"] });
  });
});

describe("formatDayList", () => {
  it("reads as a sentence", () => {
    expect(formatDayList([])).toBe("");
    expect(formatDayList(["mon"])).toBe("Mon");
    expect(formatDayList(["mon", "wed"])).toBe("Mon and Wed");
    expect(formatDayList(["mon", "wed", "fri"])).toBe("Mon, Wed and Fri");
  });
});
