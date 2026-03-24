import { describe, it, expect } from "vitest";
import { getScheduledDates } from "./schedule";

describe("getScheduledDates", () => {
  describe("daily frequency", () => {
    it("returns every day in range", () => {
      const result = getScheduledDates(
        "daily",
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
        "2026-03-01",
        "2026-03-03",
        "2026-03-05",
        "2026-03-10"
      );
      expect(result).toEqual([]);
    });
  });

  describe("specific_days frequency", () => {
    it("returns only matching days of week", () => {
      // 2026-03-02 is Monday, 2026-03-08 is Sunday
      const result = getScheduledDates(
        "specific_days",
        ["mon", "wed", "fri"],
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
        "specific_days",
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
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
        "specific_days",
        ["sat", "sun"],
        "2026-03-01",
        null,
        "2026-03-02",
        "2026-03-03"
      );
      expect(result).toEqual([]);
    });

    it("returns empty when daysOfWeek is null", () => {
      const result = getScheduledDates(
        "specific_days",
        null,
        "2026-03-01",
        null,
        "2026-03-01",
        "2026-03-07"
      );
      expect(result).toEqual([]);
    });

    it("returns empty when daysOfWeek is empty array", () => {
      const result = getScheduledDates(
        "specific_days",
        [],
        "2026-03-01",
        null,
        "2026-03-01",
        "2026-03-07"
      );
      expect(result).toEqual([]);
    });

    it("respects both schedule bounds and range bounds", () => {
      const result = getScheduledDates(
        "specific_days",
        ["mon", "fri"],
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
  });

  describe("edge cases", () => {
    it("handles single-day range", () => {
      const result = getScheduledDates(
        "daily",
        null,
        "2026-03-01",
        null,
        "2026-03-05",
        "2026-03-05"
      );
      expect(result).toEqual(["2026-03-05"]);
    });

    it("handles range start equal to range end with specific_days match", () => {
      // 2026-03-06 is Friday
      const result = getScheduledDates(
        "specific_days",
        ["fri"],
        "2026-03-01",
        null,
        "2026-03-06",
        "2026-03-06"
      );
      expect(result).toEqual(["2026-03-06"]);
    });

    it("handles range start equal to range end with specific_days no match", () => {
      // 2026-03-06 is Friday
      const result = getScheduledDates(
        "specific_days",
        ["mon"],
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
