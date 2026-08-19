"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createQuest, updateQuest } from "@/lib/actions/quests";
import { upsertSchedule, deleteSchedule } from "@/lib/actions/quest-schedules";
import { getQuestUnlockableItems, getCategoryLabel } from "@/lib/utils/avatar-catalog";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  defaultRepeatDaysForStartDate,
  syncRepeatDaysWithStartDate,
} from "@/lib/utils/schedule-days";

type Subject = { id: string; name: string; color: string | null };

type RepeatFrequency = "daily" | "weekly" | "monthly";

function ordinal(n: number): string {
  const suffix = ["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor(n % 100 / 10) === 1 ? 0 : n % 10];
  return `${n}${suffix}`;
}

type QuestData = {
  id: string;
  title: string;
  subjectId: string;
  description: string | null;
  estimatedMinutes: number | null;
  rewardXp: number | null;
  rewardDescription: string | null;
  rewardAvatarItem: string | null;
};

type ScheduleData = {
  id: string;
  frequency: string;
  daysOfWeek: string | null;
  intervalWeeks: number | null;
  startDate: string;
  endDate: string | null;
};

const ALL_AVATAR_REWARD_OPTIONS = getQuestUnlockableItems();

export function QuestTemplateForm({
  childId,
  subjects,
  quest,
  schedule,
  open,
  onClose,
  childUnlockedItems = [],
  assignedAvatarItems = [],
  schoolDays,
}: {
  childId: string;
  subjects: Subject[];
  quest?: QuestData;
  /** Existing repeat schedule for this quest, if any (edit mode only) */
  schedule?: ScheduleData | null;
  open: boolean;
  onClose: () => void;
  /** Item IDs the child has already unlocked via quest rewards */
  childUnlockedItems?: string[];
  /** Avatar reward JSON strings already assigned to other active quests */
  assignedAvatarItems?: string[];
  /** Weekday codes this child attends school on; constrains which repeat days can be picked */
  schoolDays: string[];
}) {
  const router = useRouter();
  const isEditing = !!quest;

  const [title, setTitle] = useState(quest?.title ?? "");
  const [subjectId, setSubjectId] = useState(quest?.subjectId ?? subjects[0]?.id ?? "");
  const [description, setDescription] = useState(quest?.description ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    quest?.estimatedMinutes?.toString() ?? ""
  );
  const [rewardXp, setRewardXp] = useState(quest?.rewardXp?.toString() ?? "");
  const [rewardDescription, setRewardDescription] = useState(quest?.rewardDescription ?? "");
  const [rewardAvatarItem, setRewardAvatarItem] = useState(quest?.rewardAvatarItem ?? "");
  const [showRewards, setShowRewards] = useState(
    !!(quest?.rewardXp || quest?.rewardDescription || quest?.rewardAvatarItem)
  );
  const defaultRepeatStartDate = schedule?.startDate ?? new Date().toISOString().slice(0, 10);
  const [repeatEnabled, setRepeatEnabled] = useState(!!schedule);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>(
    (schedule?.frequency as RepeatFrequency) ?? "weekly"
  );
  const [repeatDays, setRepeatDays] = useState<string[]>(
    schedule?.daysOfWeek
      ? JSON.parse(schedule.daysOfWeek)
      : defaultRepeatDaysForStartDate(defaultRepeatStartDate, schoolDays)
  );
  const [repeatIntervalWeeks, setRepeatIntervalWeeks] = useState(schedule?.intervalWeeks ?? 1);
  const [repeatStartDate, setRepeatStartDate] = useState(defaultRepeatStartDate);
  const [repeatEndDate, setRepeatEndDate] = useState(schedule?.endDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleRepeatDay(day: string) {
    if (!schoolDays.includes(day)) return;
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleRepeatStartDateChange(value: string) {
    setRepeatStartDate(value);
    if (repeatFrequency === "weekly") {
      setRepeatDays((prev) => syncRepeatDaysWithStartDate(prev, value, schoolDays));
    }
  }

  function handleSelectWeekly() {
    setRepeatFrequency("weekly");
    setRepeatDays((prev) => (prev.length > 0 ? prev : defaultRepeatDaysForStartDate(repeatStartDate, schoolDays)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const rewardFields = {
        rewardXp: rewardXp ? parseInt(rewardXp) : undefined,
        rewardDescription: rewardDescription || undefined,
        rewardAvatarItem: rewardAvatarItem || undefined,
      };

      if (repeatEnabled && repeatFrequency === "weekly") {
        if (repeatDays.length === 0) {
          throw new Error("Pick at least one day for the quest to repeat on");
        }
        if (repeatIntervalWeeks < 1) {
          throw new Error("Repeat interval must be at least 1 week");
        }
      }

      const schedulePayload = repeatEnabled
        ? {
            frequency: repeatFrequency,
            daysOfWeek: repeatFrequency === "weekly" ? repeatDays : undefined,
            intervalWeeks: repeatFrequency === "weekly" ? repeatIntervalWeeks : undefined,
            startDate: repeatStartDate,
            endDate: repeatEndDate || undefined,
          }
        : undefined;

      if (isEditing) {
        await updateQuest(quest.id, {
          title,
          subjectId,
          description,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          rewardXp: rewardXp ? parseInt(rewardXp) : null,
          rewardDescription: rewardDescription || null,
          rewardAvatarItem: rewardAvatarItem || null,
        });

        if (schedulePayload) {
          await upsertSchedule(quest.id, schedulePayload);
        } else if (schedule) {
          await deleteSchedule(quest.id);
        }
      } else {
        await createQuest({
          childId,
          subjectId,
          title,
          description: description || undefined,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          ...rewardFields,
          schedule: schedulePayload,
        });
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quest");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Quest" : "New Quest"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="quest-title">Quest Title</Label>
            <Input
              id="quest-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read Chapter 5 of the Ancient Tome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-subject">Discipline</Label>
            <Select
              id="quest-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-duration">Estimated Duration (minutes)</Label>
            <Input
              id="quest-duration"
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="30"
              min={1}
              max={480}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-description">Description (optional)</Label>
            <Input
              id="quest-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Complete exercises 1-10, review vocabulary"
            />
          </div>

          {/* Repeat Section */}
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="quest-repeat">Repeat this quest</Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically assign this quest on a schedule
                </p>
              </div>
              <Switch
                checked={repeatEnabled}
                onCheckedChange={() => setRepeatEnabled((v) => !v)}
                aria-label="Repeat this quest"
              />
            </div>

            {repeatEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={repeatFrequency === "daily" ? "default" : "outline"}
                      onClick={() => setRepeatFrequency("daily")}
                    >
                      Daily
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={repeatFrequency === "weekly" ? "default" : "outline"}
                      onClick={handleSelectWeekly}
                    >
                      Weekly
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={repeatFrequency === "monthly" ? "default" : "outline"}
                      onClick={() => setRepeatFrequency("monthly")}
                    >
                      Monthly
                    </Button>
                  </div>
                </div>

                {repeatFrequency === "weekly" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="repeat-interval">Repeat every</Label>
                      <Input
                        id="repeat-interval"
                        type="number"
                        value={repeatIntervalWeeks}
                        onChange={(e) => setRepeatIntervalWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        max={12}
                        className="w-16"
                      />
                      <span className="text-sm text-muted-foreground">
                        week{repeatIntervalWeeks === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Label>Days of the Week</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.filter((day) => schoolDays.includes(day)).map((day) => (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={repeatDays.includes(day) ? "default" : "outline"}
                          onClick={() => toggleRepeatDay(day)}
                          className="min-w-[3rem]"
                        >
                          {DAY_LABELS[day]}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      The start date&apos;s day is picked automatically; only school days can be selected.
                    </p>
                  </div>
                )}

                {repeatFrequency === "monthly" && (
                  <p className="text-[10px] text-muted-foreground">
                    Repeats on the {ordinal(new Date(repeatStartDate + "T00:00:00Z").getUTCDate())} of every month
                    (skipping non-school days).
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="repeat-start">Start Date</Label>
                    <Input
                      id="repeat-start"
                      type="date"
                      value={repeatStartDate}
                      onChange={(e) => handleRepeatStartDateChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repeat-end">End Date (optional)</Label>
                    <Input
                      id="repeat-end"
                      type="date"
                      value={repeatEndDate}
                      onChange={(e) => setRepeatEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quest Rewards Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowRewards(!showRewards)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showRewards ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Quest Rewards (optional)
            </button>

            {showRewards && (
              <div className="space-y-3 rounded-lg border border-dashed border-[var(--gold-dim)] bg-[rgba(201,168,76,0.04)] p-3">
                <div className="space-y-2">
                  <Label htmlFor="reward-xp">Bonus XP Reward</Label>
                  <Input
                    id="reward-xp"
                    type="number"
                    value={rewardXp}
                    onChange={(e) => setRewardXp(e.target.value)}
                    placeholder="e.g. 25"
                    min={5}
                    max={100}
                  />
                  <p className="text-[10px] text-muted-foreground">Extra XP on top of the standard 10 XP per quest</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-description">Custom Reward</Label>
                  <Input
                    id="reward-description"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    placeholder="e.g. 30 min screen time, pick dinner tonight"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-avatar">Avatar Item Unlock</Label>
                  <Select
                    id="reward-avatar"
                    value={rewardAvatarItem}
                    onChange={(e) => setRewardAvatarItem(e.target.value)}
                  >
                    <option value="">No avatar reward</option>
                    {ALL_AVATAR_REWARD_OPTIONS.map(({ category, item }) => {
                      const jsonVal = JSON.stringify({ category, itemId: item.id });
                      const alreadyUnlocked = childUnlockedItems.includes(item.id);
                      const alreadyAssigned = assignedAvatarItems.some((a) => {
                        try {
                          const parsed = JSON.parse(a) as { itemId: string };
                          return parsed.itemId === item.id;
                        } catch { return false; }
                      });
                      // Allow re-selecting the item that's already on THIS quest
                      const isCurrentQuest = rewardAvatarItem === jsonVal || quest?.rewardAvatarItem === jsonVal;
                      const disabled = alreadyUnlocked || (alreadyAssigned && !isCurrentQuest);
                      const suffix = alreadyUnlocked
                        ? " (already unlocked)"
                        : alreadyAssigned && !isCurrentQuest
                          ? " (assigned to another quest)"
                          : "";
                      return (
                        <option
                          key={`${category}-${item.id}`}
                          value={jsonVal}
                          disabled={disabled}
                        >
                          {getCategoryLabel(category)}: {item.label}{suffix}
                        </option>
                      );
                    })}
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Unlock a special avatar item when this quest is completed</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update Quest" : "Create Quest"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
