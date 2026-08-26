import { describe, it, expect } from "vitest";
import {
  alertPresentation,
  alertHeadline,
  alertDetail,
  bellLabel,
} from "./parent-alert-display";

describe("alertPresentation", () => {
  it("reads a skip as a skip", () => {
    expect(alertPresentation("quest_skipped").verb).toBe("skipped");
    expect(alertPresentation("quest_skipped").label).toBe("Skipped");
  });

  it("reads a stuck quest as stuck, and louder than a skip", () => {
    expect(alertPresentation("quest_stuck").verb).toBe("got stuck on");
    expect(alertPresentation("quest_stuck").tone).toBe("warn");
  });

  it("falls back to a legible row for an alert type it has never heard of", () => {
    const unknown = alertPresentation("quest_invented_next_week");
    expect(unknown.verb).toBeTruthy();
    expect(unknown.icon).toBe("bell");
    expect(unknown.tone).toBe("warn");
  });
});

describe("alertHeadline", () => {
  it("names the hero and the quest", () => {
    expect(
      alertHeadline({ type: "quest_stuck", childName: "Robin", questTitle: "Long division" })
    ).toBe('Robin got stuck on "Long division"');
  });

  it("still reads as a sentence for an unknown type", () => {
    const headline = alertHeadline({
      type: "something_new",
      childName: "Robin",
      questTitle: "Spelling",
    });
    expect(headline.startsWith("Robin ")).toBe(true);
    expect(headline).toContain('"Spelling"');
  });
});

describe("alertDetail", () => {
  it("joins subject and date", () => {
    expect(alertDetail({ subjectName: "Maths", date: "2026-08-26" })).toBe("Maths · 2026-08-26");
  });

  it("drops the separator when the quest has no subject", () => {
    expect(alertDetail({ subjectName: null, date: "2026-08-26" })).toBe("2026-08-26");
  });
});

describe("bellLabel", () => {
  it("says so when nothing is waiting", () => {
    expect(bellLabel(0)).toContain("nothing");
  });

  it("counts, and agrees with itself", () => {
    expect(bellLabel(1)).toContain("1 alert needs");
    expect(bellLabel(4)).toContain("4 alerts need");
  });
});
