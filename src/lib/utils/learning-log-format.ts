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
  "They also completed",
  "In addition, they completed",
  "They further completed",
];

export function formatLearningLog(
  childName: string,
  startDate: string,
  endDate: string,
  assignments: AssignmentRow[]
): string {
  if (assignments.length === 0) {
    return `Learning Log: ${childName}\n${formatRangeHeader(startDate, endDate)}\n\nNo assignments recorded for this period.`;
  }

  const totalCount = assignments.length;
  let totalMinutes = 0;
  const completed: string[] = [];
  const skipped: string[] = [];

  for (const entry of assignments) {
    const subject = entry.subject.name;
    const title = entry.quest.title;

    if (entry.assignment.status === "skipped") {
      skipped.push(`${title} in ${subject}`);
      continue;
    }

    const mins = entry.durationMinutes ?? entry.quest.estimatedMinutes;
    if (mins) totalMinutes += mins;

    let phrase = `${title} in ${subject}`;
    if (mins) phrase += ` (${formatDuration(mins)})`;
    if (entry.assignment.notes) phrase += ` — ${entry.assignment.notes}`;
    completed.push(phrase);
  }

  const sentences: string[] = [];
  const CHUNK_SIZE = 3;
  for (let i = 0; i < completed.length; i += CHUNK_SIZE) {
    const chunk = completed.slice(i, i + CHUNK_SIZE);
    const lead =
      i === 0 ? `This week, ${childName} completed` : CONTINUATIONS[(i / CHUNK_SIZE - 1) % CONTINUATIONS.length];
    sentences.push(`${lead} ${joinWithAnd(chunk)}.`);
  }

  if (completed.length === 0 && skipped.length > 0) {
    sentences.push(`This week, no assignments were completed.`);
  }

  if (skipped.length > 0) {
    sentences.push(`They skipped ${joinWithAnd(skipped)}.`);
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
