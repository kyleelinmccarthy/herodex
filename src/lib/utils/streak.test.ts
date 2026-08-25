import { describe, it, expect } from "vitest";
import { computeStreak, computeLongestStreak } from "./streak";
import { formatDate } from "./dates";

// Helper: a date N days before the given anchor.
function daysBefore(anchor: Date, n: number): string {
  const d = new Date(anchor);
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

describe("computeStreak", () => {
  const today = new Date("2026-06-04T12:00:00Z");

  it("returns 0 when there are no active days", () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it("counts a single day logged today", () => {
    expect(computeStreak([daysBefore(today, 0)], today)).toBe(1);
  });

  it("counts consecutive days up to and including today", () => {
    const dates = [0, 1, 2, 3].map((n) => daysBefore(today, n));
    expect(computeStreak(dates, today)).toBe(4);
  });

  it("does not break the streak when today has no activity yet", () => {
    // Logged yesterday and the day before, but not yet today.
    const dates = [daysBefore(today, 1), daysBefore(today, 2)];
    expect(computeStreak(dates, today)).toBe(2);
  });

  it("stops at the first gap before today", () => {
    // today, yesterday present; then a gap at day 2; day 3 present but unreachable.
    const dates = [daysBefore(today, 0), daysBefore(today, 1), daysBefore(today, 3)];
    expect(computeStreak(dates, today)).toBe(2);
  });

  it("returns 0 when the most recent activity is older than yesterday", () => {
    // Neither today nor yesterday — streak is broken.
    const dates = [daysBefore(today, 2), daysBefore(today, 3)];
    expect(computeStreak(dates, today)).toBe(0);
  });

  it("ignores duplicate dates", () => {
    const y = daysBefore(today, 0);
    expect(computeStreak([y, y, y], today)).toBe(1);
  });

  describe("with non-school days", () => {
    // 2026-06-04 is a Thursday; 2026-05-30/31 are Sat/Sun.
    const monFri = ["mon", "tue", "wed", "thu", "fri"];
    const monday = new Date("2026-06-01T12:00:00Z");

    it("does not reset the streak over a weekend", () => {
      // Logged Thu + Fri, nothing over the weekend, now it's Monday.
      const dates = ["2026-05-28", "2026-05-29"];
      expect(computeStreak(dates, monday, { schoolDays: monFri })).toBe(2);
    });

    it("keeps counting through the weekend when Monday is logged too", () => {
      const dates = ["2026-06-01", "2026-05-29", "2026-05-28"];
      expect(computeStreak(dates, monday, { schoolDays: monFri })).toBe(3);
    });

    it("still counts activity logged on a non-school day", () => {
      // Sat + Sun logged as a bonus on top of Thu/Fri.
      const dates = ["2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31"];
      expect(computeStreak(dates, monday, { schoolDays: monFri })).toBe(4);
    });

    it("still breaks on a missed school day", () => {
      // Thursday missed; only Friday counts back from Monday.
      const dates = ["2026-05-29", "2026-05-27"];
      expect(computeStreak(dates, monday, { schoolDays: monFri })).toBe(1);
    });

    it("honors a custom school-day selection", () => {
      // Tue/Thu-only hero: Fri, Sat, Sun, Mon and Wed are all days off.
      const dates = ["2026-05-28", "2026-05-26"];
      expect(computeStreak(dates, monday, { schoolDays: ["tue", "thu"] })).toBe(2);
    });

    it("does not reset the streak over a school break", () => {
      const dates = ["2026-05-22"]; // the Friday before a week-long break
      const breaks = [{ startDate: "2026-05-25", endDate: "2026-05-29" }];
      expect(computeStreak(dates, monday, { schoolDays: monFri, breaks })).toBe(1);
    });

    it("treats break boundaries as inclusive", () => {
      // Break covers Mon-Fri; the streak reaches back past it to the prior Friday.
      const dates = ["2026-05-22", "2026-05-21"];
      const breaks = [{ startDate: "2026-05-25", endDate: "2026-05-29" }];
      expect(computeStreak(dates, monday, { schoolDays: monFri, breaks })).toBe(2);
    });

    it("does not reset the streak on an optional school day", () => {
      // Friday is a school day, but marked optional — a quiet Friday is fine.
      const dates = ["2026-05-28", "2026-06-01"];
      expect(
        computeStreak(dates, monday, { schoolDays: monFri, optionalDays: ["fri"] })
      ).toBe(2);
      // Without the optional tag, the missed Friday ends the streak at Monday.
      expect(computeStreak(dates, monday, { schoolDays: monFri })).toBe(1);
    });

    it("still counts activity logged on an optional day", () => {
      const dates = ["2026-05-28", "2026-05-29", "2026-06-01"];
      expect(
        computeStreak(dates, monday, { schoolDays: monFri, optionalDays: ["fri"] })
      ).toBe(3);
    });

    it("ignores an optional day that isn't a school day anyway", () => {
      const dates = ["2026-05-28", "2026-06-01"];
      expect(
        computeStreak(dates, monday, { schoolDays: monFri, optionalDays: ["sun"] })
      ).toBe(1);
    });

    it("treats every day as a school day when no options are given", () => {
      const dates = ["2026-05-28", "2026-05-29"];
      expect(computeStreak(dates, monday)).toBe(0);
    });
  });

  it("caps the look-back at 365 days", () => {
    // A full year-plus of consecutive days — should not exceed the 365 cap.
    const dates = Array.from({ length: 400 }, (_, n) => daysBefore(today, n));
    expect(computeStreak(dates, today)).toBe(365);
  });
});

describe("computeLongestStreak", () => {
  const monFri = ["mon", "tue", "wed", "thu", "fri"];

  it("returns 0 for an empty history", () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it("finds the longest run, not the most recent one", () => {
    // Four in a row in May, then a broken pair in June.
    const dates = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-06-02"];
    expect(computeLongestStreak(dates, { schoolDays: monFri })).toBe(4);
  });

  it("carries a run across a weekend", () => {
    // Thu, Fri, then Mon, Tue — one 4-day run once the weekend is skipped.
    const dates = ["2026-05-28", "2026-05-29", "2026-06-01", "2026-06-02"];
    expect(computeLongestStreak(dates, { schoolDays: monFri })).toBe(4);
    // Without school days, the same history is two separate 2-day runs.
    expect(computeLongestStreak(dates)).toBe(2);
  });

  it("carries a run across a school break", () => {
    const dates = ["2026-05-22", "2026-06-01"];
    const breaks = [{ startDate: "2026-05-25", endDate: "2026-05-29" }];
    expect(computeLongestStreak(dates, { schoolDays: monFri, breaks })).toBe(2);
  });

  it("resets on a missed school day", () => {
    // Wednesday 2026-05-27 is missed, so the run restarts on Thursday.
    const dates = ["2026-05-25", "2026-05-26", "2026-05-28", "2026-05-29"];
    expect(computeLongestStreak(dates, { schoolDays: monFri })).toBe(2);
  });

  it("carries a run across an optional day", () => {
    // Thu, then Mon — Friday is optional and the weekend is off.
    const dates = ["2026-05-28", "2026-06-01"];
    expect(
      computeLongestStreak(dates, { schoolDays: monFri, optionalDays: ["fri"] })
    ).toBe(2);
    expect(computeLongestStreak(dates, { schoolDays: monFri })).toBe(1);
  });

  it("ignores duplicates and unsorted input", () => {
    const dates = ["2026-06-02", "2026-06-01", "2026-06-02", "2026-05-29"];
    expect(computeLongestStreak(dates, { schoolDays: monFri })).toBe(3);
  });
});
