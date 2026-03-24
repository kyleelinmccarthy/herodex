import { describe, it, expect, vi, afterEach } from "vitest";
import { deriveAgeMode } from "./age-mode";

describe("deriveAgeMode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'elementary' for ages 10 and under", () => {
    const currentYear = new Date().getFullYear();
    expect(deriveAgeMode(currentYear - 6)).toBe("elementary");
    expect(deriveAgeMode(currentYear - 10)).toBe("elementary");
  });

  it("returns 'middle' for ages 11-14", () => {
    const currentYear = new Date().getFullYear();
    expect(deriveAgeMode(currentYear - 11)).toBe("middle");
    expect(deriveAgeMode(currentYear - 14)).toBe("middle");
  });

  it("returns 'high' for ages 15 and above", () => {
    const currentYear = new Date().getFullYear();
    expect(deriveAgeMode(currentYear - 15)).toBe("high");
    expect(deriveAgeMode(currentYear - 18)).toBe("high");
  });
});
