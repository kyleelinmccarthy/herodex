import { describe, it, expect } from "vitest";
import { getWeekStartDate, getWeekEndDate, formatDate } from "./dates";

describe("formatDate", () => {
  it("formats date as ISO date string", () => {
    const date = new Date("2026-03-16T12:00:00Z");
    expect(formatDate(date)).toBe("2026-03-16");
  });
});

describe("getWeekStartDate", () => {
  it("returns Monday for a Wednesday", () => {
    // March 18, 2026 is a Wednesday
    const date = new Date("2026-03-18T12:00:00Z");
    expect(getWeekStartDate(date)).toBe("2026-03-16");
  });

  it("returns Monday for a Monday", () => {
    const date = new Date("2026-03-16T12:00:00Z");
    expect(getWeekStartDate(date)).toBe("2026-03-16");
  });

  it("returns previous Monday for a Sunday", () => {
    // March 22, 2026 is a Sunday
    const date = new Date("2026-03-22T12:00:00Z");
    expect(getWeekStartDate(date)).toBe("2026-03-16");
  });
});

describe("getWeekEndDate", () => {
  it("returns Sunday for a Wednesday", () => {
    const date = new Date("2026-03-18T12:00:00Z");
    expect(getWeekEndDate(date)).toBe("2026-03-22");
  });

  it("returns Sunday for a Sunday", () => {
    const date = new Date("2026-03-22T12:00:00Z");
    expect(getWeekEndDate(date)).toBe("2026-03-22");
  });
});
