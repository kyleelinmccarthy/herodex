import { describe, it, expect } from "vitest";
import {
  timeRangesOverlap,
  weekdayOfDate,
  addDaysToDate,
  defaultRepeatDaysForStartDate,
  syncRepeatDaysWithStartDate,
  parseSchoolDays,
  parseStreakOptionalDays,
  DEFAULT_SCHOOL_DAYS,
} from "./schedule-days";

describe("timeRangesOverlap", () => {
  it("detects a fully contained overlap", () => {
    expect(timeRangesOverlap("09:00", "10:00", "09:15", "09:45")).toBe(true);
  });

  it("detects a partial overlap", () => {
    expect(timeRangesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
  });

  it("treats back-to-back ranges as non-overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("returns false for ranges on the same day but far apart", () => {
    expect(timeRangesOverlap("09:00", "10:00", "13:00", "14:00")).toBe(false);
  });

  it("detects an identical range as overlapping", () => {
    expect(timeRangesOverlap("09:00", "10:00", "09:00", "10:00")).toBe(true);
  });
});

describe("weekdayOfDate", () => {
  it("maps a known Monday correctly", () => {
    expect(weekdayOfDate("2026-03-02")).toBe("mon");
  });

  it("maps a known Sunday correctly", () => {
    expect(weekdayOfDate("2026-03-08")).toBe("sun");
  });
});

describe("addDaysToDate", () => {
  it("adds days within a month", () => {
    expect(addDaysToDate("2026-03-01", 3)).toBe("2026-03-04");
  });

  it("crosses a month boundary", () => {
    expect(addDaysToDate("2026-02-27", 3)).toBe("2026-03-02");
  });

  it("supports negative offsets", () => {
    expect(addDaysToDate("2026-03-02", -1)).toBe("2026-03-01");
  });
});

describe("defaultRepeatDaysForStartDate", () => {
  it("returns the start date's weekday when it's a school day", () => {
    // 2026-03-02 is Monday
    expect(defaultRepeatDaysForStartDate("2026-03-02", ["mon", "tue", "wed", "thu", "fri"])).toEqual(["mon"]);
  });

  it("returns empty when the start date's weekday isn't a school day", () => {
    // 2026-03-07 is Saturday
    expect(defaultRepeatDaysForStartDate("2026-03-07", ["mon", "tue", "wed", "thu", "fri"])).toEqual([]);
  });
});

describe("syncRepeatDaysWithStartDate", () => {
  it("adds the start date's weekday when missing and valid", () => {
    // 2026-03-04 is Wednesday
    expect(syncRepeatDaysWithStartDate(["mon"], "2026-03-04", ["mon", "tue", "wed", "thu", "fri"])).toEqual([
      "mon",
      "wed",
    ]);
  });

  it("leaves days unchanged when the weekday is already present", () => {
    expect(syncRepeatDaysWithStartDate(["mon", "wed"], "2026-03-04", ["mon", "tue", "wed", "thu", "fri"])).toEqual([
      "mon",
      "wed",
    ]);
  });

  it("leaves days unchanged when the start date isn't a school day", () => {
    // 2026-03-07 is Saturday
    expect(syncRepeatDaysWithStartDate(["mon"], "2026-03-07", ["mon", "tue", "wed", "thu", "fri"])).toEqual(["mon"]);
  });
});

describe("parseSchoolDays", () => {
  it("falls back to Mon-Fri for null, empty, and malformed values", () => {
    expect(parseSchoolDays(null)).toEqual(DEFAULT_SCHOOL_DAYS);
    expect(parseSchoolDays("[]")).toEqual(DEFAULT_SCHOOL_DAYS);
    expect(parseSchoolDays("not json")).toEqual(DEFAULT_SCHOOL_DAYS);
    expect(parseSchoolDays('{"mon":true}')).toEqual(DEFAULT_SCHOOL_DAYS);
  });

  it("keeps a stored selection and drops unrecognized codes", () => {
    expect(parseSchoolDays('["mon","tue","funday"]')).toEqual(["mon", "tue"]);
  });
});

describe("parseStreakOptionalDays", () => {
  it("defaults to none — every school day counts unless tagged", () => {
    expect(parseStreakOptionalDays(null)).toEqual([]);
    expect(parseStreakOptionalDays("[]")).toEqual([]);
    expect(parseStreakOptionalDays("not json")).toEqual([]);
  });

  it("keeps a stored selection and drops unrecognized codes", () => {
    expect(parseStreakOptionalDays('["fri","someday"]')).toEqual(["fri"]);
  });
});
