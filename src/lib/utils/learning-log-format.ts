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

// Short form, for the parentheses beside an activity and the totals line.
function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min`;
}

// Spelled out, for durations that sit inside the prose itself — "I read for
// 45 minutes" reads like a sentence in a way "for 45 min" does not.
function formatDurationWords(totalMinutes: number): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs} hour${hrs > 1 ? "s" : ""}`);
  if (mins > 0) parts.push(`${mins} minute${mins > 1 ? "s" : ""}`);
  if (parts.length === 0) return "0 minutes";
  return parts.join(" and ");
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Cleaning raw parent/child text for use inside a sentence ──────────

// A learning log may be handed to a school district, so it should read as
// prose about what was learned — never as a set of instructions with URLs
// pointing at whatever site the work lived on.
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// Bare domains ("ixl.com/math/grade-3"). The TLD is matched case-sensitively
// in lower or upper form only, so a missing space after a period —
// "the worksheet.Info is on page 4" — is not mistaken for a domain.
const BARE_DOMAIN_RE =
  /\b[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.(?:com|COM|org|ORG|net|NET|edu|EDU|gov|GOV|io|IO|co|CO|us|US|app|APP|dev|DEV|info|INFO)\b(?:\/\S*)?/g;

function stripLinks(text: string): string {
  return text
    .replace(MARKDOWN_LINK_RE, "$1")
    .replace(URL_RE, " ")
    .replace(BARE_DOMAIN_RE, " ");
}

// Prepositions left hanging once the link they pointed at is gone
// ("Lesson 3 at https://…" -> "Lesson 3 at" -> "Lesson 3").
const DANGLING_PREPOSITION_RE =
  /\s+(?:at|on|from|via|to|in|into|with|using|through|onto|over|the)$/i;

function tidy(text: string): string {
  let out = text;
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out
      .replace(/\s+/g, " ")
      .replace(/\(\s*\)|\[\s*\]/g, "")
      .replace(/\s+([,;:.])/g, "$1")
      .replace(/^[\s,;:.\-–—]+/, "")
      .replace(/^(?:and|then|also)\s+/i, "")
      .replace(/[\s,;:\-–—]+$/, "")
      .replace(DANGLING_PREPOSITION_RE, "")
      .replace(/\.+$/, "")
      .trim();
    if (out === before) break;
  }
  return out;
}

// Leading instructions like "Login to X and ..." describe how to reach the
// assignment, not what was done — drop them so the sentence reads naturally.
// The site name is usually gone by now (stripLinks ran first), so the
// target is optional: "Login to ixl.com and do..." arrives as "Login to and do...".
const ACCESS_CLAUSE_RE = /^(?:log\s*in|sign\s*in|go)\s+to\s*.*?\s*and\s+/i;

// Verbs that only restate the sentence's own verb, e.g. "Complete Science
// lessons" would otherwise read "I worked on Complete Science lessons".
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

function stripLeadingVerb(text: string, verbs: string[]): string {
  for (const verb of verbs) {
    const match = text.match(new RegExp(`^${verb}\\s+`, "i"));
    if (match) return text.slice(match[0].length);
  }
  return text;
}

// Cleans up assignment titles (and scribe's notes) for use inside a
// first-person sentence: no links, no access instructions, and no action
// verbs that stop making sense once the text is embedded in the log's prose.
function normalizeForSentence(raw: string, extraVerbs: string[] = []): string {
  const trimmed = tidy(stripLinks(raw));
  if (!trimmed) return "";

  let text = trimmed;

  const withoutAccessClause = tidy(text.replace(ACCESS_CLAUSE_RE, ""));
  if (withoutAccessClause) text = withoutAccessClause;

  // A verb can be left behind by the access clause (e.g. "...and complete
  // Science lessons" -> "complete Science lessons"), so strip up to twice.
  const verbs = [...extraVerbs, ...REDUNDANT_LEAD_VERBS];
  for (let i = 0; i < 2; i++) {
    const stripped = tidy(stripLeadingVerb(text, verbs));
    if (!stripped || stripped === text) break;
    text = stripped;
  }

  return text || trimmed;
}

// Openers that were capitalised only because the note began there; "I" and
// anything that might be a name are left alone.
const MID_SENTENCE_OPENERS =
  /^(?:We|They|He|She|It|You|The|A|An|My|Our|This|That|These|Those|There|Then|First|Next|Today)\b/;

function lowercaseOpener(text: string): string {
  if (!MID_SENTENCE_OPENERS.test(text)) return text;
  return text[0].toLowerCase() + text.slice(1);
}

// ── Subjects ─────────────────────────────────────────────────────────

const READING_SUBJECT_RE = /\b(?:read|reading|literacy|literature|phonics)\b/i;

// Names for the same subject. A family shares one sentence, so a week logged
// under both "Reading" and "Read Aloud" doesn't read as two subjects. Only
// true synonyms belong here — sibling disciplines a parent tracks apart
// (History and Social Studies, Art and Music) stay apart on the record.
const SUBJECT_SYNONYMS: string[][] = [
  ["reading", "read aloud", "read alouds", "literature", "literacy", "phonics"],
  ["math", "maths", "mathematics", "arithmetic"],
  ["language arts", "english language arts", "ela"],
  ["physical education", "pe", "phys ed", "gym"],
  ["writing", "composition"],
  ["art", "arts and crafts", "art and craft"],
];

const SYNONYM_FAMILY = new Map<string, string>(
  SUBJECT_SYNONYMS.flatMap((family) =>
    family.map((name) => [name, family[0]] as [string, string])
  )
);

function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectFamily(name: string): string {
  const normalized = normalizeSubjectName(name);
  return SYNONYM_FAMILY.get(normalized) ?? normalized;
}

// Folds the week's subject names into families: exact synonyms, plus any
// name that only qualifies another one already in the week ("Math Facts"
// joins "Math", "Reading Comprehension" joins "Reading"). A qualifier with
// no plain subject to attach to stays a subject of its own.
function resolveSubjectFamilies(names: string[]): {
  familyOf: Map<string, string>;
  labelOf: Map<string, string>;
  readingFamilies: Set<string>;
} {
  const keyOf = new Map<string, string>();
  for (const name of names) {
    if (!keyOf.has(name)) keyOf.set(name, subjectFamily(name));
  }
  const present = new Set(keyOf.values());

  const familyOf = new Map<string, string>();
  for (const [name, key] of keyOf) {
    let family = key;
    for (const other of present) {
      if (
        other.length < family.length &&
        key.startsWith(`${other} `)
      ) {
        family = other;
      }
    }
    familyOf.set(name, family);
  }

  // The plainest name in the family labels it — "Math" over "Math Facts".
  const labelOf = new Map<string, string>();
  const readingFamilies = new Set<string>();
  for (const [name, family] of familyOf) {
    const current = labelOf.get(family);
    if (!current || name.length < current.length) labelOf.set(family, name);
    if (READING_SUBJECT_RE.test(name)) readingFamilies.add(family);
  }

  return { familyOf, labelOf, readingFamilies };
}

// In a reading group the sentence's own verb is "read", so a title that
// starts with it would read "I read read a chapter of...".
const READING_LEAD_VERBS = ["read(?:\\s+aloud)?(?:\\s+from)?", "reading"];

// Titles that carry no information beyond the subject itself — "Read",
// "Math", "Daily work". These become time spent rather than a named activity.
const GENERIC_TITLE_RE =
  /^(?:read(?:ing)?(?:\s+time)?|read\s+a\s+book|silent\s+reading|independent\s+reading|book|books|lesson|lessons|work|daily\s+work|schoolwork|homework|assignment|assignments|practice|study|studying)$/i;

// True when the sentence opens by naming its subject, so tacking "for
// Reading" onto "I read for 45 minutes" (or "for Math" onto "Math facts") is
// noise. Only the lead is checked: a list whose *second* activity happens to
// mention Math still needs telling which subject it belongs to.
// Matched on a prefix boundary so "Read" covers "reading" and "reader".
function mentionsSubject(lead: string, subject: string): boolean {
  const name = subject.trim().toLowerCase();
  if (!name) return true;

  const candidates = new Set<string>([name]);
  if (name.endsWith("ing") && name.length > 5) candidates.add(name.slice(0, -3));
  if (name.endsWith("s") && name.length > 3) candidates.add(name.slice(0, -1));

  return [...candidates].some(
    (candidate) =>
      candidate.length >= 3 &&
      new RegExp(`\\b${escapeRegExp(candidate)}`, "i").test(lead)
  );
}

// ── Sentence assembly ────────────────────────────────────────────────

type Piece = {
  title: string;
  minutes: number | null;
  note: string | null;
  generic: boolean;
};

type Group = { subject: string; reading: boolean; pieces: Piece[] };

// Transitive phrases that all read correctly in front of an activity name,
// rotated so a busy week doesn't repeat one verb a dozen times.
const NEUTRAL_VERBS = ["worked on", "did", "spent time on"];

// Frames rotate so consecutive sentences don't all open the same way.
function frame(index: number, subject: string | null, body: string): string {
  const forSubject = subject ? ` for ${subject}` : "";
  switch (index % 4) {
    case 0:
      return index === 0
        ? `This week I ${body}${forSubject}.`
        : `I ${body}${forSubject}.`;
    case 1:
      return subject ? `For ${subject}, I also ${body}.` : `I also ${body}.`;
    case 2:
      return `I ${body}${forSubject} as well.`;
    default:
      return subject ? `For ${subject}, I ${body} too.` : `I ${body} too.`;
  }
}

// A sentence's predicate, plus the opening phrase the subject check reads.
type Body = { text: string; lead: string };

function readingBody(pieces: Piece[]): Body {
  const total = pieces.reduce((sum, p) => sum + (p.minutes ?? 0), 0);

  const details: string[] = [];
  for (const piece of pieces) {
    if (piece.generic) {
      // Nothing to name, so the scribe's note is the only detail worth having.
      if (piece.note) details.push(piece.note);
    } else if (piece.note) {
      details.push(`${piece.title} (${piece.note})`);
    } else {
      details.push(piece.title);
    }
  }

  if (total > 0) {
    const including = details.length
      ? `, including ${joinWithAnd(details)}`
      : "";
    return { text: `read for ${formatDurationWords(total)}${including}`, lead: "read" };
  }
  return {
    text: details.length ? `read ${joinWithAnd(details)}` : "read",
    lead: "read",
  };
}

function namedBody(verb: string, pieces: Piece[]): Body {
  const items = pieces.map((piece) => {
    const aside: string[] = [];
    if (piece.minutes) aside.push(formatDuration(piece.minutes));
    if (piece.note) aside.push(piece.note);
    return aside.length ? `${piece.title} (${aside.join(" — ")})` : piece.title;
  });
  return { text: `${verb} ${joinWithAnd(items)}`, lead: `${verb} ${items[0]}` };
}

// One sentence per subject stays readable up to about here; past it the list
// runs on, so it continues in a fresh sentence instead.
const CHUNK_SIZE = 3;

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

  const ordered = [...logged].sort((a, b) =>
    a.assignment.date.localeCompare(b.assignment.date)
  );

  // Group by subject — folding near-duplicate subject names together — so the
  // log says "For Math, I ..." once instead of naming the subject after every
  // single activity, or once per spelling of the same subject.
  const { familyOf, labelOf, readingFamilies } = resolveSubjectFamilies(
    ordered.map((entry) => entry.subject.name)
  );

  const groups: Group[] = [];
  const byFamily = new Map<string, Group>();

  for (const entry of ordered) {
    const subjectName = entry.subject.name;
    const family = familyOf.get(subjectName) ?? subjectName;
    const label = labelOf.get(family) ?? subjectName;
    const reading = readingFamilies.has(family);

    let group = byFamily.get(family);
    if (!group) {
      group = { subject: label, reading, pieces: [] };
      byFamily.set(family, group);
      groups.push(group);
    }

    const base = normalizeForSentence(entry.quest.title);
    const note = entry.assignment.notes
      ? lowercaseOpener(normalizeForSentence(entry.assignment.notes))
      : "";

    const minutes = entry.durationMinutes ?? entry.quest.estimatedMinutes;
    if (minutes) totalMinutes += minutes;

    // Judged before the reading verb comes off, so "Reading time" is still
    // recognised as saying nothing beyond the subject.
    const generic =
      !base ||
      GENERIC_TITLE_RE.test(base) ||
      normalizeSubjectName(base) === normalizeSubjectName(subjectName) ||
      normalizeSubjectName(base) === family;

    const title = reading
      ? tidy(stripLeadingVerb(base, READING_LEAD_VERBS)) || base
      : base;

    group.pieces.push({
      title: title || subjectName,
      minutes: minutes ?? null,
      note: note || null,
      // A generic title with no time on it would leave the sentence with
      // nothing to say, so keep it as a named activity instead.
      generic: generic && Boolean(minutes),
    });
  }

  const sentences: string[] = [];
  let lastSubject: string | null = null;

  for (const group of groups) {
    const bodies: Body[] = [];

    if (group.reading) {
      bodies.push(readingBody(group.pieces));
    } else {
      const named = group.pieces.filter((p) => !p.generic);
      const genericMinutes = group.pieces
        .filter((p) => p.generic)
        .reduce((sum, p) => sum + (p.minutes ?? 0), 0);

      for (let i = 0; i < named.length; i += CHUNK_SIZE) {
        const verb = NEUTRAL_VERBS[(sentences.length + bodies.length) % NEUTRAL_VERBS.length];
        bodies.push(namedBody(verb, named.slice(i, i + CHUNK_SIZE)));
      }
      if (genericMinutes > 0) {
        const worked = `worked for ${formatDurationWords(genericMinutes)}`;
        bodies.push({ text: worked, lead: worked });
      }
    }

    for (const body of bodies) {
      // Drop the subject when the sentence already names it, and when the
      // sentence before it was about the same subject.
      const named =
        group.subject === lastSubject || mentionsSubject(body.lead, group.subject)
          ? null
          : group.subject;
      sentences.push(frame(sentences.length, named, body.text));
      lastSubject = group.subject;
    }
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
