"use client";

import Link from "next/link";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import {
  formatDayList,
  scheduleGapSignature,
  type SubjectScheduleGap,
} from "@/lib/utils/schedule-gaps";
import { useDismissedNotice } from "@/hooks/use-dismissed-notice";

const DISMISSED_KEY = "kingdomsandcrowns-dismissed-schedule-gaps";

export type HeroScheduleGaps = {
  gaps: SubjectScheduleGap[];
  /** Sends the fix link to the right hero's schedule. */
  childId?: string;
  /** Set only when more than one hero is in view, so the list groups by name. */
  childName?: string;
};

/**
 * Names the disciplines whose scheduled quests land on days they aren't taught.
 *
 * A quest's repeat and the weekly schedule only ever meet through the subject,
 * so the mismatch leaves no trace anywhere a parent looks: the assignment is
 * created as asked, then quietly falls to the bottom of the hero's day with no
 * time on it — last in the queue on a structured day. This is the standing
 * reminder that the gap exists and where to close it.
 *
 * Takes every hero at once rather than being repeated per child: the whole
 * family's gaps are one problem with one fix, and a stack of identical headers
 * read as several unrelated warnings.
 *
 * Renders nothing when there's nothing wrong, so it can sit unconditionally in
 * a page's layout.
 */
export function ScheduleGapNotice({
  heroes,
  showFixLink = true,
  dismissible = false,
}: {
  heroes: HeroScheduleGaps[];
  /** Off on the schedule page itself, where the parent is already where they'd be sent. */
  showFixLink?: boolean;
  /**
   * Lets a parent clear the panel once they've taken it in. On by default
   * nowhere: the schedule page's copy is the one sitting next to the fix, so
   * hiding it there would only make the gap harder to close.
   */
  dismissible?: boolean;
}) {
  const withGaps = heroes.filter((hero) => hero.gaps.length > 0);
  const signature = scheduleGapSignature(withGaps);
  const { dismissed, dismiss } = useDismissedNotice(DISMISSED_KEY);

  if (withGaps.length === 0) return null;
  if (dismissible) {
    // `undefined` is the pre-hydration answer. Holding the panel back for that
    // one pass is what stops a notice the parent already cleared from flashing
    // up again on every single load.
    if (dismissed === undefined) return null;
    if (dismissed === signature) return null;
  }

  return (
    <GameFrame
      title="Quests with no class time"
      icon={<GameIcon name="calendar" className="size-4 text-[var(--gold-bright)]" />}
      action={
        dismissible ? (
          <button
            type="button"
            onClick={() => dismiss(signature)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Dismiss
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {withGaps.map((hero, index) => (
          <div key={hero.childId ?? index} className="space-y-1.5">
            {(hero.childName || showFixLink) && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {hero.childName && (
                  <p className="font-brand text-sm font-bold" style={{ color: "var(--gold-bright)" }}>
                    {hero.childName}
                  </p>
                )}
                {showFixLink && (
                  <Link
                    href={hero.childId ? `/schedule?child=${hero.childId}` : "/schedule"}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {hero.childName ? `Fix ${hero.childName}'s schedule →` : "Fix the weekly schedule →"}
                  </Link>
                )}
              </div>
            )}
            {hero.gaps.map((gap) => (
              <div key={gap.subjectId} className="text-sm">
                <p>
                  <span className="font-medium">{gap.subjectName}</span>{" "}
                  {gap.neverScheduled
                    ? "isn't on the weekly schedule at all"
                    : `has no class time on ${formatDayList(gap.missingDays)}`}
                  , but{" "}
                  {gap.questTitles.length === 1 ? "a quest is" : `${gap.questTitles.length} quests are`}{" "}
                  scheduled {gap.neverScheduled ? `for ${formatDayList(gap.missingDays)}` : "then"}.
                </p>
                <p className="text-xs text-muted-foreground">
                  {gap.questTitles.slice(0, 3).join(", ")}
                  {gap.questTitles.length > 3 ? ` and ${gap.questTitles.length - 3} more` : ""}
                </p>
              </div>
            ))}
          </div>
        ))}

        {/* Said once for the whole list rather than after every line, which is
            what made a two-hero notice read like four separate warnings. */}
        <p className="border-t border-border/30 pt-2 text-xs text-muted-foreground">
          These land at the bottom of the day with no time on them, and a hero on a structured day
          reaches them last.
          {!showFixLink &&
            " Add a class time below — a subject can share an existing slot by using its exact start and end time."}
          {dismissible &&
            " Dismissing hides this until a new gap appears; the weekly schedule always shows the current ones."}
        </p>
      </div>
    </GameFrame>
  );
}
