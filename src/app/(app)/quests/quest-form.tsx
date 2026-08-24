"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import { createAssignment, completeAssignment } from "@/lib/actions/quest-assignments";
import { useQuestTimer } from "@/hooks/use-quest-timer";
import { formatDate } from "@/lib/utils/dates";
import { formatTimeOfDay } from "@/lib/utils/schedule-days";

type Subject = {
  id: string;
  name: string;
  color: string | null;
};

type Quest = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  estimatedMinutes: number | null;
  hasSchedule: boolean;
};

type TodayAssignment = {
  assignment: { id: string; status: string };
  quest: { id: string };
};

type ScheduleBlock = {
  subjectId: string;
  startTime: string;
  endTime: string;
};

export function QuestForm({
  childId,
  subjects,
  quests,
  todayAssignments,
  todaysBlocks = [],
  nowTime,
  latestStatusByQuestId = {},
}: {
  childId: string;
  subjects: Subject[];
  quests: Quest[];
  todayAssignments: TodayAssignment[];
  todaysBlocks?: ScheduleBlock[];
  nowTime?: string;
  latestStatusByQuestId?: Record<string, { status: string; date: string }>;
}) {
  const router = useRouter();
  const { startTimer } = useQuestTimer();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [showDuration, setShowDuration] = useState(false);

  // Build a map from questId -> existing assignment id for today
  const assignmentByQuestId = new Map(
    todayAssignments.map((a) => [a.quest.id, a.assignment.id])
  );

  // A quest already completed or skipped today shouldn't still be offered to start again.
  const todayStatusByQuestId = new Map(
    todayAssignments.map((a) => [a.quest.id, a.assignment.status])
  );
  // Recurring quests only belong in the list on the days they're actually
  // assigned; quests with no recurring schedule are one-off/bonus quests
  // that stay available any day until completed or skipped (checked against
  // their most recent assignment ever, not just today's, so a one-off
  // finished or skipped on a previous day doesn't reappear).
  const assignedTodayQuestIds = new Set(todayAssignments.map((a) => a.quest.id));
  const availableQuests = quests.filter((q) => {
    const todayStatus = todayStatusByQuestId.get(q.id);
    if (todayStatus === "completed" || todayStatus === "skipped") return false;
    if (assignedTodayQuestIds.has(q.id)) return true;
    if (q.hasSchedule) return false;
    const latestStatus = latestStatusByQuestId[q.id]?.status;
    return latestStatus !== "completed" && latestStatus !== "skipped";
  });

  // Earliest scheduled block per subject today, so a subject scheduled twice
  // still sorts/labels by its first occurrence.
  const blockBySubjectId = new Map<string, ScheduleBlock>();
  for (const block of todaysBlocks) {
    const existing = blockBySubjectId.get(block.subjectId);
    if (!existing || block.startTime < existing.startTime) {
      blockBySubjectId.set(block.subjectId, block);
    }
  }

  function blockStatus(block: ScheduleBlock | undefined): "current" | "upcoming" | "past" | "unscheduled" {
    if (!block || !nowTime) return "unscheduled";
    if (nowTime < block.startTime) return "upcoming";
    if (nowTime >= block.endTime) return "past";
    return "current";
  }

  // Serve up what's scheduled right now first, then what's coming up today,
  // then anything already past, then anything with no schedule slot at all —
  // so a hero sees what to do next instead of hunting through the full list.
  const STATUS_RANK = { current: 0, upcoming: 1, past: 2, unscheduled: 3 };
  const sortedQuests = availableQuests
    .map((q, index) => ({ quest: q, block: blockBySubjectId.get(q.subjectId), index }))
    .sort((a, b) => {
      const rankDiff = STATUS_RANK[blockStatus(a.block)] - STATUS_RANK[blockStatus(b.block)];
      if (rankDiff !== 0) return rankDiff;
      if (a.block && b.block && a.block.startTime !== b.block.startTime) {
        return a.block.startTime.localeCompare(b.block.startTime);
      }
      return a.index - b.index;
    })
    .map((entry) => entry.quest);

  const [selectedQuestId, setSelectedQuestId] = useState(sortedQuests[0]?.id ?? "");
  const selectedQuest = availableQuests.find((q) => q.id === selectedQuestId);

  // A completed quest drops out of availableQuests on the router.refresh()
  // after a submit, but selectedQuestId is otherwise never touched — resync
  // it so a stale id can't leave the form pointed at a quest that no longer
  // exists (which made the next Quick Complete silently no-op).
  useEffect(() => {
    if (selectedQuestId && !availableQuests.some((q) => q.id === selectedQuestId)) {
      setSelectedQuestId(sortedQuests[0]?.id ?? "");
    }
  }, [selectedQuestId, availableQuests, sortedQuests]);
  const selectedSubject = subjects.find((s) => s.id === selectedQuest?.subjectId);
  const selectedBlock = selectedQuest ? blockBySubjectId.get(selectedQuest.subjectId) : undefined;
  const selectedStatus = blockStatus(selectedBlock);

  /** Return the existing assignment ID or create a new one */
  async function getOrCreateAssignment(questId: string): Promise<string> {
    const existing = assignmentByQuestId.get(questId);
    if (existing) return existing;
    const today = formatDate(new Date());
    const { id } = await createAssignment({ questId, childId, date: today });
    return id;
  }

  async function handleStartTimer() {
    if (!selectedQuestId) return;
    setSaving(true);
    setError("");
    try {
      const assignmentId = await getOrCreateAssignment(selectedQuestId);
      startTimer(assignmentId);
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start quest");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickComplete() {
    if (!selectedQuestId || !selectedQuest) return;
    setSaving(true);
    setError("");
    try {
      const assignmentId = await getOrCreateAssignment(selectedQuestId);
      const duration = manualDuration
        ? parseInt(manualDuration)
        : selectedQuest.estimatedMinutes ?? undefined;
      await completeAssignment(assignmentId, {
        title: selectedQuest.title,
        description: description || (selectedQuest.description ?? undefined),
        durationMinutes: duration,
        source: "manual",
      });
      setDescription("");
      setManualDuration("");
      setShowDuration(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete quest");
    } finally {
      setSaving(false);
    }
  }

  if (quests.length === 0) {
    return (
      <GameFrame title="Start a Quest" icon={<GameIcon name="swords" className="size-5 text-[var(--gold-bright)]" />}>
        <div className="py-3 text-center text-sm text-muted-foreground">
          No quests have been forged yet. Ask your parent to create some!
        </div>
      </GameFrame>
    );
  }

  if (availableQuests.length === 0) {
    return (
      <GameFrame title="Start a Quest" icon={<GameIcon name="swords" className="size-5 text-[var(--gold-bright)]" />}>
        <div className="py-3 text-center text-sm text-muted-foreground">
          All of today&apos;s quests are complete. Well done, hero!
        </div>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Start a Quest" icon={<GameIcon name="swords" className="size-5 text-[var(--gold-bright)]" />}>
      <div>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="quest-select">Choose a Quest</Label>
          <Select
            id="quest-select"
            value={selectedQuestId}
            onChange={(e) => {
              setSelectedQuestId(e.target.value);
              setShowDuration(false);
              setManualDuration("");
            }}
          >
            {sortedQuests.map((q) => {
              const sub = subjects.find((s) => s.id === q.subjectId);
              const block = blockBySubjectId.get(q.subjectId);
              const status = blockStatus(block);
              const statusSuffix =
                status === "current" ? " · now" : status === "upcoming" ? " · upcoming" : status === "past" ? " · missed" : "";
              const timeLabel = block ? `, ${formatTimeOfDay(block.startTime)}${statusSuffix}` : "";
              return (
                <option key={q.id} value={q.id}>
                  {q.title}{sub ? ` (${sub.name}${timeLabel})` : ""}
                </option>
              );
            })}
          </Select>
        </div>

        {selectedQuest && (
          <div className="space-y-2 rounded-md border border-border/30 bg-card/30 px-4 py-3">
            <div className="flex items-center gap-2">
              {selectedSubject && (
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedSubject.color ?? "#6b7280" }}
                />
              )}
              <span
                className="text-base font-bold"
                style={{
                  color:
                    selectedStatus === "upcoming" || selectedStatus === "past"
                      ? "var(--foreground)"
                      : "var(--gold-bright)",
                }}
              >
                {selectedQuest.title}
              </span>
              {selectedQuest.estimatedMinutes && (
                <span className="text-sm text-muted-foreground">
                  ~{selectedQuest.estimatedMinutes}min
                </span>
              )}
              {selectedBlock && (
                <span
                  className={`text-xs font-medium ${
                    selectedStatus === "current"
                      ? "text-[var(--gold-bright)]"
                      : selectedStatus === "past"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {selectedStatus === "current"
                    ? "Scheduled now"
                    : selectedStatus === "upcoming"
                      ? "Not due yet — scheduled for"
                      : "Missed — was scheduled for"}{" "}
                  {formatTimeOfDay(selectedBlock.startTime)}–{formatTimeOfDay(selectedBlock.endTime)}
                </span>
              )}
            </div>
            {selectedQuest.description && (
              <p className="text-sm text-muted-foreground">
                {selectedQuest.description}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="quest-notes">Scribe&apos;s Notes (optional)</Label>
          <Input
            id="quest-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Conquered chapter 3 of the ancient tome"
          />
        </div>

        {showDuration && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={manualDuration}
              onChange={(e) => setManualDuration(e.target.value)}
              placeholder={selectedQuest?.estimatedMinutes ? `${selectedQuest.estimatedMinutes}` : "min"}
              min={1}
              max={480}
              className="w-24"
              aria-label="Duration in minutes"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleStartTimer} disabled={saving || !selectedQuest} className="gap-2">
            {saving ? (
              "Starting..."
            ) : (
              <>
                <GameIcon name="timer" className="size-4 text-[var(--gold-bright)]" />
                Start Timer
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (showDuration) {
                handleQuickComplete();
              } else {
                setShowDuration(true);
              }
            }}
            disabled={saving || !selectedQuest}
            className="gap-2 !border-[var(--gold-bright)]"
          >
            {saving ? (
              "Saving..."
            ) : showDuration ? (
              <>
                <GameIcon name="check" className="size-4 text-[var(--gold-bright)]" />
                Submit
              </>
            ) : (
              <>
                <GameIcon name="check" className="size-4 text-[var(--gold-bright)]" />
                Quick Complete
              </>
            )}
          </Button>
          {showDuration && (
            <Button variant="ghost" onClick={() => setShowDuration(false)} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </GameFrame>
  );
}
