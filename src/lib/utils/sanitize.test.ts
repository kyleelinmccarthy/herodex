import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeName, sanitizeEmail } from "./sanitize";

describe("sanitizeText", () => {
  it("strips HTML tags", () => {
    expect(sanitizeText("<script>alert('xss')</script>Hello")).toBe(
      "alert('xss')Hello"
    );
    expect(sanitizeText("<b>bold</b>")).toBe("bold");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(200);
    expect(sanitizeText(long, 100)).toHaveLength(100);
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });
});

describe("sanitizeName", () => {
  it("truncates to 100 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeName(long)).toHaveLength(100);
  });
});

describe("sanitizeEmail", () => {
  it("lowercases email", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("truncates to 254 characters", () => {
    const long = "a".repeat(300) + "@example.com";
    expect(sanitizeEmail(long).length).toBeLessThanOrEqual(254);
  });
});
