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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00"); // avoid timezone shift
  const day = DAY_NAMES[d.getDay()];
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`;
}

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

export function formatLearningLog(
  childName: string,
  startDate: string,
  endDate: string,
  assignments: AssignmentRow[]
): string {
  if (assignments.length === 0) {
    return `Learning Log: ${childName}\n${formatRangeHeader(startDate, endDate)}\n\nNo assignments recorded for this period.`;
  }

  // Group by subject
  const bySubject = new Map<string, AssignmentRow[]>();
  for (const row of assignments) {
    const subj = row.subject.name;
    if (!bySubject.has(subj)) bySubject.set(subj, []);
    bySubject.get(subj)!.push(row);
  }

  // Sort subjects alphabetically
  const sortedSubjects = [...bySubject.keys()].sort();

  const lines: string[] = [];
  lines.push(`Learning Log: ${childName}`);
  lines.push(formatRangeHeader(startDate, endDate));

  let totalCount = 0;
  let totalMinutes = 0;

  for (const subject of sortedSubjects) {
    const entries = bySubject.get(subject)!;
    // Sort by date
    entries.sort((a, b) => a.assignment.date.localeCompare(b.assignment.date));

    lines.push("");
    lines.push(`--- ${subject} ---`);

    for (const entry of entries) {
      totalCount++;
      const dateLabel = formatDateLabel(entry.assignment.date);
      const title = entry.quest.title;

      if (entry.assignment.status === "skipped") {
        lines.push(`• ${dateLabel}: ${title} — Skipped`);
      } else {
        const mins =
          entry.durationMinutes ??
          entry.quest.estimatedMinutes;
        if (mins) {
          totalMinutes += mins;
          lines.push(`• ${dateLabel}: ${title} (${mins} min)`);
        } else {
          lines.push(`• ${dateLabel}: ${title}`);
        }
      }

      if (entry.assignment.notes) {
        lines.push(`  Notes: ${entry.assignment.notes}`);
      }
    }
  }

  lines.push("");
  lines.push(
    `Total: ${totalCount} activit${totalCount === 1 ? "y" : "ies"}${
      totalMinutes > 0 ? `, ${formatDuration(totalMinutes)}` : ""
    }`
  );

  return lines.join("\n");
}
