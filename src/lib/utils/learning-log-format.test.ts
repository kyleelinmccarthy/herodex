import { describe, it, expect } from "vitest";
import { formatLearningLog } from "./learning-log-format";

type Row = Parameters<typeof formatLearningLog>[3][number];

function row(
  subject: string,
  title: string,
  opts: {
    minutes?: number | null;
    estimated?: number | null;
    notes?: string | null;
    status?: string;
    date?: string;
  } = {}
): Row {
  return {
    assignment: {
      date: opts.date ?? "2026-03-02",
      status: opts.status ?? "completed",
      notes: opts.notes ?? null,
      completedAt: null,
    },
    quest: { title, estimatedMinutes: opts.estimated ?? null },
    subject: { name: subject },
    durationMinutes: opts.minutes ?? null,
  };
}

function body(text: string): string {
  return text.split("\n")[3];
}

const log = (rows: Row[]) =>
  formatLearningLog("Jordan", "2026-03-02", "2026-03-06", rows);

describe("links", () => {
  it("drops a url from a quest title, along with the preposition holding it", () => {
    const text = body(log([row("Math", "Lesson 3 at https://khanacademy.org/math/3", { minutes: 30 })]));
    expect(text).not.toMatch(/http|khanacademy/);
    expect(text).toBe("This week I worked on Lesson 3 (30 min) for Math.");
  });

  it("drops a bare domain from the scribe's notes", () => {
    const text = body(log([row("Science", "Volcano experiment", { minutes: 20, notes: "watched the video on brainpop.com" })]));
    expect(text).not.toMatch(/brainpop/);
    expect(text).toBe("This week I worked on Volcano experiment (20 min — watched the video) for Science.");
  });

  it("keeps the label of a markdown link but not its url", () => {
    const text = body(log([row("History", "Read about [the Oregon Trail](https://example.org/trail)", { minutes: 25 })]));
    expect(text).not.toMatch(/example\.org|http/);
    expect(text).toMatch(/the Oregon Trail/);
  });

  it("does not mistake a missing space after a period for a domain", () => {
    const text = body(log([row("Math", "Fractions", { minutes: 15, notes: "Pages 4-5.Info on page 6 too" })]));
    expect(text).toMatch(/Info on page 6/);
  });

  it("drops a whole 'log in and do X' instruction, site and all", () => {
    const text = body(log([row("History", "Login to ixl.com and complete the Oregon Trail unit", { minutes: 40 })]));
    expect(text).toBe("This week I worked on the Oregon Trail unit (40 min) for History.");
  });

  it("falls back to time spent when the title was nothing but a link", () => {
    const text = body(log([row("Math", "https://ixl.com/math/grade-3", { minutes: 30 })]));
    expect(text).not.toMatch(/ixl|http/);
    expect(text).toBe("This week I worked for 30 minutes for Math.");
  });
});

describe("subject is not said twice", () => {
  it("does not append the subject when the activity already names it", () => {
    const text = body(log([row("Math", "Math facts drill", { minutes: 10 })]));
    expect(text).toBe("This week I worked on Math facts drill (10 min).");
  });

  it("names each subject once instead of after every activity", () => {
    const text = body(
      log([
        row("Math", "Fractions worksheet", { minutes: 20 }),
        row("Math", "Times tables", { minutes: 10 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Fractions worksheet (20 min) and Times tables (10 min) for Math."
    );
  });

  it("drops the subject on a follow-up sentence about the same subject", () => {
    const text = body(
      log([
        row("Science", "A", { minutes: 5 }),
        row("Science", "B", { minutes: 5 }),
        row("Science", "C", { minutes: 5 }),
        row("Science", "D", { minutes: 5 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on A (5 min), B (5 min), and C (5 min) for Science. I also did D (5 min)."
    );
  });
});

describe("prose details", () => {
  it("lowercases a note's opener now that it sits mid-sentence", () => {
    const text = body(log([row("Science", "Volcano", { minutes: 45, notes: "We used baking soda and vinegar." })]));
    expect(text).toBe("This week I worked on Volcano (45 min — we used baking soda and vinegar) for Science.");
  });

  it("leaves a note that opens on a name alone", () => {
    const text = body(log([row("Reading", "Read", { minutes: 20, notes: "Charlotte's Web" })]));
    expect(text).toMatch(/including Charlotte's Web/);
  });

  it("still names the subject when only a later activity in the list mentions it", () => {
    const text = body(
      log([
        row("Math", "Adding fractions", { minutes: 20 }),
        row("Math", "Math facts quiz", { minutes: 10 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Adding fractions (20 min) and Math facts quiz (10 min) for Math."
    );
  });
});

describe("similar subjects share a sentence", () => {
  it("folds a qualified subject into the plain one it qualifies", () => {
    const text = body(
      log([
        row("Math", "Adding fractions", { minutes: 20 }),
        row("Math Facts", "Times tables", { minutes: 10 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Adding fractions (20 min) and Times tables (10 min) for Math."
    );
  });

  it("treats synonyms for the same subject as one subject", () => {
    const text = body(
      log([
        row("Reading", "Read", { minutes: 30, date: "2026-03-02" }),
        row("Read Aloud", "Read Hatchet", { minutes: 15, date: "2026-03-03" }),
      ])
    );
    expect(text).toBe("This week I read for 45 minutes, including Hatchet.");
  });

  it("matches subject names past their punctuation and casing", () => {
    const text = body(
      log([
        row("Language Arts", "Paragraph practice", { minutes: 20 }),
        row("language-arts", "Spelling list", { minutes: 10 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Paragraph practice (20 min) and Spelling list (10 min) for Language Arts."
    );
  });

  it("keeps genuinely different subjects apart", () => {
    const text = body(
      log([
        row("Math", "Fractions", { minutes: 20 }),
        row("Science", "Volcano", { minutes: 20 }),
        row("History", "Oregon Trail", { minutes: 20 }),
      ])
    );
    expect(text).toMatch(/for Math\./);
    expect(text).toMatch(/For Science/);
    expect(text).toMatch(/for History/);
  });

  it("leaves a qualified subject standing alone when nothing plainer is logged", () => {
    const text = body(log([row("Math Facts", "Times tables", { minutes: 10 })]));
    expect(text).toBe("This week I worked on Times tables (10 min) for Math Facts.");
  });

  it("still spots a title that only echoes the subject after a merge", () => {
    const text = body(
      log([
        row("Math", "Fractions", { minutes: 20, date: "2026-03-02" }),
        row("Math Facts", "Math Facts", { minutes: 10, date: "2026-03-03" }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Fractions (20 min) for Math. I also worked for 10 minutes."
    );
  });
});

describe("reading", () => {
  it("says how long was spent reading rather than completing 'Read'", () => {
    const text = body(log([row("Reading", "Read", { minutes: 20 })]));
    expect(text).toBe("This week I read for 20 minutes.");
  });

  it("adds up the week's reading into one span of time", () => {
    const text = body(
      log([
        row("Reading", "Read", { minutes: 30, date: "2026-03-02" }),
        row("Reading", "Reading time", { minutes: 45, date: "2026-03-03" }),
      ])
    );
    expect(text).toBe("This week I read for 1 hour and 15 minutes.");
  });

  it("names what was read without repeating the verb", () => {
    const text = body(log([row("Reading", "Read Charlotte's Web", { minutes: 25 })]));
    expect(text).toBe("This week I read for 25 minutes, including Charlotte's Web.");
  });

  it("carries the scribe's note on a generic reading quest", () => {
    const text = body(log([row("Reading", "Read", { minutes: 20, notes: "Chapters 4 and 5" })]));
    expect(text).toBe("This week I read for 20 minutes, including Chapters 4 and 5.");
  });

  it("still reads as a sentence when no time was recorded", () => {
    const text = body(log([row("Reading", "Read Hatchet")]));
    expect(text).toBe("This week I read Hatchet.");
  });
});

describe("prose", () => {
  it("varies the sentence openings instead of repeating 'I completed'", () => {
    const text = body(
      log([
        row("Math", "Fractions", { minutes: 20 }),
        row("Reading", "Read", { minutes: 30 }),
        row("Science", "Volcano", { minutes: 25 }),
        row("Art", "Watercolor", { minutes: 15 }),
        row("History", "Oregon Trail", { minutes: 20 }),
      ])
    );
    expect(text).toBe(
      "This week I worked on Fractions (20 min) for Math. I also read for 30 minutes. " +
        "I spent time on Volcano (25 min) for Science as well. For Art, I worked on Watercolor (15 min) too. " +
        "I did Oregon Trail (20 min) for History."
    );
    expect(text).not.toMatch(/In addition/);
    expect(text).not.toMatch(/I completed/);
  });

  it("breaks a long subject list into a second sentence", () => {
    const text = body(
      log([
        row("Math", "A"),
        row("Math", "B"),
        row("Math", "C"),
        row("Math", "D"),
      ])
    );
    expect(text).toBe("This week I worked on A, B, and C for Math. I also did D.");
  });
});

describe("the record itself", () => {
  it("counts activities and time", () => {
    const text = log([
      row("Math", "Fractions", { minutes: 20 }),
      row("Reading", "Read", { minutes: 45 }),
    ]);
    expect(text.split("\n").at(-1)).toBe("Total: 2 activities, 1 hr 5 min");
  });

  it("uses the estimate when nothing was timed", () => {
    const text = log([row("Math", "Fractions", { estimated: 30 })]);
    expect(text.split("\n").at(-1)).toBe("Total: 1 activity, 30 min");
  });

  it("leaves out work that was skipped or got stuck", () => {
    const text = log([
      row("Math", "Fractions", { minutes: 20 }),
      row("Science", "Volcano", { minutes: 20, status: "skipped" }),
      row("Art", "Watercolor", { minutes: 20, status: "stuck" }),
    ]);
    expect(text).not.toMatch(/Volcano|Watercolor/);
    expect(text.split("\n").at(-1)).toBe("Total: 1 activity, 20 min");
  });

  it("says so plainly when there is nothing to report", () => {
    expect(log([])).toMatch(/No assignments recorded for this period\./);
  });
});
