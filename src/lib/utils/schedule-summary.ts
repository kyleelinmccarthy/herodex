import { DAY_LABELS, DAYS_OF_WEEK, type DayOfWeek } from "@/lib/utils/schedule-days";

export type SummarizableSchedule = {
  frequency: string;
  daysOfWeek: string | null; // JSON array, as stored
  intervalWeeks: number | null;
  startDate: string;
  endDate: string | null;
};

/** What a quest with no schedule row actually is, in words a parent reads rather than infers. */
export const ANYTIME_LABEL = "Anytime";

export const ANYTIME_DESCRIPTION =
  "Available to start on any day until it's completed. It won't appear in Today's Quests or Upcoming Quests.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-28" -> "Aug 28". Parsed as UTC so it can't drift a day in a western timezone. */
export function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function ordinal(n: number): string {
  const suffix = ["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10];
  return `${n}${suffix}`;
}

/**
 * A one-line, at-a-glance description of when a quest comes up — the thing the
 * Quest Giver list was missing, which left "repeats Mon/Wed" and "available any
 * day forever" looking identical to a parent.
 *
 * `null` means the quest has no schedule row at all, which is a real state with
 * real consequences, so it gets a name ("Anytime") instead of a blank.
 */
export function describeSchedule(schedule: SummarizableSchedule | null | undefined): string {
  if (!schedule) return ANYTIME_LABEL;

  const until = schedule.endDate ? ` · until ${formatShortDate(schedule.endDate)}` : "";

  switch (schedule.frequency) {
    case "once":
      return `Once · ${formatShortDate(schedule.startDate)}`;
    case "daily":
      return `Daily${until}`;
    case "weekly": {
      const days = parseDays(schedule.daysOfWeek);
      const dayList = days.length > 0 ? days.map((d) => DAY_LABELS[d]).join(", ") : "Weekly";
      const interval = schedule.intervalWeeks && schedule.intervalWeeks > 1
        ? ` · every ${schedule.intervalWeeks} weeks`
        : "";
      return `${dayList}${interval}${until}`;
    }
    case "monthly":
      return `Monthly · ${ordinal(new Date(`${schedule.startDate}T00:00:00Z`).getUTCDate())}${until}`;
    default:
      return ANYTIME_LABEL;
  }
}

/** Selected weekdays in calendar order, so "wed,mon" always reads "Mon, Wed". */
function parseDays(raw: string | null): DayOfWeek[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return DAYS_OF_WEEK.filter((d) => parsed.includes(d));
  } catch {
    return [];
  }
}
