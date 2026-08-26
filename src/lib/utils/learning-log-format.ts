type AssignmentRow = {
  assignment: {
    date: string;
    status: string;
    notes: string | null;
    completedAt: Date | null;
  };
  quest: {
    title: string;
    estimatedMinutes: number | null;
  };
  subject: {
    name: string;
  };
  durationMinutes?: number | null;
};

function formatRangeHeader(startDate: string, endDate: string): string {
  const s = new Date(startDate + "T12:00:00");
  const e = new Date(endDate + "T12:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const fmt = (d: Date) =>
    `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const CONTINUATIONS = [
  "I also completed",
  "In addition, I completed",
  "I further completed",
];

// Leading instructions like "Login to X and ..." describe how to reach the
// assignment, not what was done — drop them so the sentence reads naturally
// after "I completed ...".
const ACCESS_CLAUSE_RE = /^(?:log\s*in|sign\s*in|go)\s+to\s+.+?\s+and\s+/i;

// Verbs that only restate "I completed", e.g. "Complete Science lessons"
// would otherwise read "I completed Complete Science lessons".
const REDUNDANT_LEAD_VERBS = [
  "log\\s*in to",
  "sign\\s*in to",
  "go to",
  "complete",
  "finish(?:\\s+up)?",
  "do",
  "submit",
  "turn in",
  "work on",
];

function stripLeadingVerb(text: string): string {
  for (const verb of REDUNDANT_LEAD_VERBS) {
    const match = text.match(new RegExp(`^${verb}\\s+`, "i"));
    if (match) return text.slice(match[0].length);
  }
  return text;
}

// Cleans up assignment titles (and scribe's notes) for use inside a
// first-person sentence, stripping access instructions and redundant
// action verbs that don't make sense once embedded in the log's prose.
function normalizeForSentence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  let text = trimmed;

  const withoutAccessClause = text.replace(ACCESS_CLAUSE_RE, "").trim();
  if (withoutAccessClause) text = withoutAccessClause;

  // A verb can be left behind by the access clause (e.g. "...and complete
  // Science lessons" -> "complete Science lessons"), so strip up to twice.
  for (let i = 0; i < 2; i++) {
    const stripped = stripLeadingVerb(text).trim();
    if (!stripped || stripped === text) break;
    text = stripped;
  }

  return text || trimmed;
}

export function formatLearningLog(
  childName: string,
  startDate: string,
  endDate: string,
  assignments: AssignmentRow[]
): string {
  // Only finished work belongs in a record a parent may hand to a school:
  // skipped quests weren't done, and stuck ones were attempted but not
  // finished. Both are visible to the grown-ups elsewhere.
  const logged = assignments.filter((entry) => entry.assignment.status === "completed");

  if (logged.length === 0) {
    return `Learning Log: ${childName}\n${formatRangeHeader(startDate, endDate)}\n\nNo assignments recorded for this period.`;
  }

  const totalCount = logged.length;
  let totalMinutes = 0;
  const completed: string[] = [];

  for (const entry of logged) {
    const subject = entry.subject.name;
    const title = normalizeForSentence(entry.quest.title);

    const mins = entry.durationMinutes ?? entry.quest.estimatedMinutes;
    if (mins) totalMinutes += mins;

    let phrase = `${title} in ${subject}`;
    if (mins) phrase += ` (${formatDuration(mins)})`;
    if (entry.assignment.notes) {
      phrase += ` — ${normalizeForSentence(entry.assignment.notes)}`;
    }
    completed.push(phrase);
  }

  const sentences: string[] = [];
  const CHUNK_SIZE = 3;
  for (let i = 0; i < completed.length; i += CHUNK_SIZE) {
    const chunk = completed.slice(i, i + CHUNK_SIZE);
    const lead =
      i === 0 ? `This week, I completed` : CONTINUATIONS[(i / CHUNK_SIZE - 1) % CONTINUATIONS.length];
    sentences.push(`${lead} ${joinWithAnd(chunk)}.`);
  }

  const lines: string[] = [];
  lines.push(`Learning Log: ${childName}`);
  lines.push(formatRangeHeader(startDate, endDate));
  lines.push("");
  lines.push(sentences.join(" "));
  lines.push("");
  lines.push(
    `Total: ${totalCount} activit${totalCount === 1 ? "y" : "ies"}${
      totalMinutes > 0 ? `, ${formatDuration(totalMinutes)}` : ""
    }`
  );

  return lines.join("\n");
}
