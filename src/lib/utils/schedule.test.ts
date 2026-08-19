import { describe, it, expect } from "vitest";
import { getScheduledDates } from "./schedule";

describe("getScheduledDates", () => {
  describe("daily frequency", () => {
    it("returns every day in range", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-01", // schedule start
        null,         // no end
        "2026-03-01", // range start
        "2026-03-05"  // range end
      );
      expect(result).toEqual([
        "2026-03-01",
        "2026-03-02",
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
      ]);
    });

    it("respects schedule start date when range starts earlier", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-03",
        null,
        "2026-03-01",
        "2026-03-05"
      );
      expect(result).toEqual(["2026-03-03", "2026-03-04", "2026-03-05"]);
    });

    it("respects schedule end date when range ends later", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-01",
        "2026-03-03",
        "2026-03-01",
        "2026-03-05"
      );
      expect(result).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    });

    it("returns empty when schedule starts after range ends", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-04-01",
        null,
        "2026-03-01",
        "2026-03-05"
      );
      expect(result).toEqual([]);
    });

    it("returns empty when schedule ends before range starts", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-01",
        "2026-03-03",
        "2026-03-05",
        "2026-03-10"
      );
      expect(result).toEqual([]);
    });

    it("excludes dates that aren't school days when schoolDays is given", () => {
      // 2026-03-02..08 is Mon..Sun
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-02",
        null,
        "2026-03-02",
        "2026-03-08",
        ["mon", "tue", "wed", "thu", "fri"]
      );
      expect(result).toEqual([
        "2026-03-02",
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
      ]);
    });
  });

  describe("weekly frequency", () => {
    it("returns only matching days of week", () => {
      // 2026-03-02 is Monday, 2026-03-08 is Sunday
      const result = getScheduledDates(
        "weekly",
        ["mon", "wed", "fri"],
        1,
        "2026-03-01",
        null,
        "2026-03-02", // Monday
        "2026-03-08"  // Sunday
      );
      expect(result).toEqual([
        "2026-03-02", // Mon
        "2026-03-04", // Wed
        "2026-03-06", // Fri
      ]);
    });

    it("handles all 7 days", () => {
      const result = getScheduledDates(
        "weekly",
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        1,
        "2026-03-01",
        null,
        "2026-03-02",
        "2026-03-04"
      );
      expect(result).toEqual(["2026-03-02", "2026-03-03", "2026-03-04"]);
    });

    it("returns empty when no days match in range", () => {
      // 2026-03-02 is Monday, 2026-03-03 is Tuesday
      const result = getScheduledDates(
        "weekly",
        ["sat", "sun"],
        1,
        "2026-03-01",
        null,
        "2026-03-02",
        "2026-03-03"
      );
      expect(result).toEqual([]);
    });

    it("returns empty when daysOfWeek is null", () => {
      const result = getScheduledDates(
        "weekly",
        null,
        1,
        "2026-03-01",
        null,
        "2026-03-01",
        "2026-03-07"
      );
      expect(result).toEqual([]);
    });

    it("returns empty when daysOfWeek is empty array", () => {
      const result = getScheduledDates(
        "weekly",
        [],
        1,
        "2026-03-01",
        null,
        "2026-03-01",
        "2026-03-07"
      );
      expect(result).toEqual([]);
    });

    it("respects both schedule bounds and range bounds", () => {
      const result = getScheduledDates(
        "weekly",
        ["mon", "fri"],
        1,
        "2026-03-04", // Wed — schedule starts mid-week
        "2026-03-13", // Fri — schedule ends
        "2026-03-01", // Mon — range starts before schedule
        "2026-03-15"  // Sun — range ends after schedule
      );
      expect(result).toEqual([
        "2026-03-06", // Fri (first matching day after schedule start)
        "2026-03-09", // Mon
        "2026-03-13", // Fri (last day of schedule)
      ]);
    });

    it("defaults interval to every week when intervalWeeks is null", () => {
      const result = getScheduledDates(
        "weekly",
        ["mon"],
        null,
        "2026-03-02", // Monday
        null,
        "2026-03-02",
        "2026-03-16"
      );
      expect(result).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
    });

    it("skips weeks when intervalWeeks is 2 (biweekly)", () => {
      // Start Monday 2026-03-02; every other week only.
      const result = getScheduledDates(
        "weekly",
        ["mon", "wed"],
        2,
        "2026-03-02",
        null,
        "2026-03-02",
        "2026-03-23"
      );
      expect(result).toEqual([
        "2026-03-02", // Mon, week 0
        "2026-03-04", // Wed, week 0
        "2026-03-16", // Mon, week 2
        "2026-03-18", // Wed, week 2
      ]);
    });

    it("skips weeks when intervalWeeks is 3", () => {
      const result = getScheduledDates(
        "weekly",
        ["mon"],
        3,
        "2026-03-02",
        null,
        "2026-03-02",
        "2026-03-30"
      );
      expect(result).toEqual(["2026-03-02", "2026-03-23"]);
    });

    it("excludes non-school days even if selected in daysOfWeek", () => {
      const result = getScheduledDates(
        "weekly",
        ["mon", "sat"],
        1,
        "2026-03-02",
        null,
        "2026-03-02",
        "2026-03-08",
        ["mon", "tue", "wed", "thu", "fri"]
      );
      expect(result).toEqual(["2026-03-02"]);
    });
  });

  describe("monthly frequency", () => {
    it("returns the matching day-of-month across the range", () => {
      const result = getScheduledDates(
        "monthly",
        null,
        null,
        "2026-01-15",
        null,
        "2026-01-01",
        "2026-04-01"
      );
      expect(result).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    });

    it("falls back to the last day of shorter months", () => {
      // Start on day 31 — Feb 2026 only has 28 days.
      const result = getScheduledDates(
        "monthly",
        null,
        null,
        "2026-01-31",
        null,
        "2026-01-01",
        "2026-03-31"
      );
      expect(result).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    });

    it("respects schoolDays for monthly too", () => {
      // 2026-03-15 is a Sunday.
      const result = getScheduledDates(
        "monthly",
        null,
        null,
        "2026-03-15",
        null,
        "2026-03-01",
        "2026-03-31",
        ["mon", "tue", "wed", "thu", "fri"]
      );
      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles single-day range", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-03-01",
        null,
        "2026-03-05",
        "2026-03-05"
      );
      expect(result).toEqual(["2026-03-05"]);
    });

    it("handles range start equal to range end with weekly match", () => {
      // 2026-03-06 is Friday
      const result = getScheduledDates(
        "weekly",
        ["fri"],
        1,
        "2026-03-01",
        null,
        "2026-03-06",
        "2026-03-06"
      );
      expect(result).toEqual(["2026-03-06"]);
    });

    it("handles range start equal to range end with weekly no match", () => {
      // 2026-03-06 is Friday
      const result = getScheduledDates(
        "weekly",
        ["mon"],
        1,
        "2026-03-01",
        null,
        "2026-03-06",
        "2026-03-06"
      );
      expect(result).toEqual([]);
    });

    it("handles month boundaries", () => {
      const result = getScheduledDates(
        "daily",
        null,
        null,
        "2026-01-01",
        null,
        "2026-02-27",
        "2026-03-02"
      );
      expect(result).toEqual([
        "2026-02-27",
        "2026-02-28",
        "2026-03-01",
        "2026-03-02",
      ]);
    });
  });
});
