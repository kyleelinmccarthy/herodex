import Link from "next/link";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import { formatDayList, type SubjectScheduleGap } from "@/lib/utils/schedule-gaps";

/**
 * Names the disciplines whose scheduled quests land on days they aren't taught.
 *
 * A quest's repeat and the weekly schedule only ever meet through the subject,
 * so the mismatch leaves no trace anywhere a parent looks: the assignment is
 * created as asked, then quietly falls to the bottom of the hero's day with no
 * time on it — last in the queue on a structured day. This is the standing
 * reminder that the gap exists and where to close it.
 *
 * Renders nothing when there's nothing wrong, so it can sit unconditionally in
 * a page's layout.
 */
export function ScheduleGapNotice({
  gaps,
  childId,
  childName,
  showFixLink = true,
}: {
  gaps: SubjectScheduleGap[];
  /** Passed through to the schedule link so it opens on the right hero. */
  childId?: string;
  /** Set when more than one hero is in view, so each line says whose gap it is. */
  childName?: string;
  /** Off on the schedule page itself, where the parent is already where they'd be sent. */
  showFixLink?: boolean;
}) {
  if (gaps.length === 0) return null;

  return (
    <GameFrame
      title="Quests with no class time"
      icon={<GameIcon name="calendar" className="size-4 text-[var(--gold-bright)]" />}
    >
      <div className="space-y-2">
        {gaps.map((gap) => (
          <div key={gap.subjectId} className="text-sm">
            <p>
              {childName && <span className="font-medium">{childName} — </span>}
              <span className="font-medium">{gap.subjectName}</span>{" "}
              {gap.neverScheduled
                ? "isn't on the weekly schedule at all"
                : `has no class time on ${formatDayList(gap.missingDays)}`}
              , but {gap.questTitles.length === 1 ? "a quest is" : `${gap.questTitles.length} quests are`}{" "}
              scheduled {gap.neverScheduled ? `for ${formatDayList(gap.missingDays)}` : "then"}.
            </p>
            <p className="text-xs text-muted-foreground">
              {gap.questTitles.slice(0, 3).join(", ")}
              {gap.questTitles.length > 3 ? ` and ${gap.questTitles.length - 3} more` : ""} — these
              land at the bottom of the day with no time on them, and a hero on a structured day
              reaches them last.
            </p>
          </div>
        ))}
        {showFixLink && (
          <Link
            href={childId ? `/schedule?child=${childId}` : "/schedule"}
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            Fix the weekly schedule →
          </Link>
        )}
        {!showFixLink && (
          <p className="text-xs text-muted-foreground">
            Add a class time below — a subject can share an existing slot by using its exact start
            and end time.
          </p>
        )}
      </div>
    </GameFrame>
  );
}
