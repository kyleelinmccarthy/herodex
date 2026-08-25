import { describe, it, expect } from "vitest";
import { describeSchedule, formatShortDate, ANYTIME_LABEL } from "./schedule-summary";

const base = {
  frequency: "weekly",
  daysOfWeek: null as string | null,
  intervalWeeks: null as number | null,
  startDate: "2026-08-25",
  endDate: null as string | null,
};

describe("describeSchedule", () => {
  it("names the no-schedule state instead of leaving it blank", () => {
    expect(describeSchedule(null)).toBe(ANYTIME_LABEL);
    expect(describeSchedule(undefined)).toBe(ANYTIME_LABEL);
  });

  it("describes a one-off by its date", () => {
    expect(describeSchedule({ ...base, frequency: "once", startDate: "2026-08-28" })).toBe("Once · Aug 28");
  });

  it("describes daily, with an end date when there is one", () => {
    expect(describeSchedule({ ...base, frequency: "daily" })).toBe("Daily");
    expect(describeSchedule({ ...base, frequency: "daily", endDate: "2026-09-30" })).toBe(
      "Daily · until Sep 30"
    );
  });

  it("lists weekly days in calendar order regardless of stored order", () => {
    expect(describeSchedule({ ...base, daysOfWeek: JSON.stringify(["wed", "mon"]) })).toBe("Mon, Wed");
  });

  it("calls out a multi-week interval", () => {
    expect(
      describeSchedule({ ...base, daysOfWeek: JSON.stringify(["mon"]), intervalWeeks: 2 })
    ).toBe("Mon · every 2 weeks");
  });

  it("omits the interval when it repeats every week", () => {
    expect(
      describeSchedule({ ...base, daysOfWeek: JSON.stringify(["mon"]), intervalWeeks: 1 })
    ).toBe("Mon");
  });

  it("describes monthly by day-of-month", () => {
    expect(describeSchedule({ ...base, frequency: "monthly", startDate: "2026-08-01" })).toBe(
      "Monthly · 1st"
    );
    expect(describeSchedule({ ...base, frequency: "monthly", startDate: "2026-08-22" })).toBe(
      "Monthly · 22nd"
    );
    expect(describeSchedule({ ...base, frequency: "monthly", startDate: "2026-08-13" })).toBe(
      "Monthly · 13th"
    );
  });

  it("falls back to a plain label when weekly days are missing or malformed", () => {
    expect(describeSchedule({ ...base, daysOfWeek: "not json" })).toBe("Weekly");
    expect(describeSchedule({ ...base, daysOfWeek: "[]" })).toBe("Weekly");
  });
});

describe("formatShortDate", () => {
  it("does not drift a day in a western timezone", () => {
    expect(formatShortDate("2026-01-01")).toBe("Jan 1");
    expect(formatShortDate("2026-12-31")).toBe("Dec 31");
  });
});
