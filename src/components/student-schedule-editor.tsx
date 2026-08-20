"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import {
  copyScheduleBlocks,
  createScheduleBlock,
  deleteScheduleBlock,
  setSchoolDays,
} from "@/lib/actions/student-schedule";
import {
  DAYS_OF_WEEK,
  addMinutesToTime,
  formatTimeOfDay,
  timeRangesOverlap,
  timeToMinutes,
  todayDayOfWeek,
  type DayOfWeek,
} from "@/lib/utils/schedule-days";

const LAST_SLOT_KEY = "kingdomsandcrowns-last-schedule-slot";
const DEFAULT_SLOT_DURATION_MINUTES = 45;

function readLastTimeSlot(): { startTime: string; endTime: string } | null {
  try {
    const raw = localStorage.getItem(LAST_SLOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.startTime === "string" && typeof parsed?.endTime === "string") {
      return parsed;
    }
  } catch {
    // ignore malformed/inaccessible storage
  }
  return null;
}

function writeLastTimeSlot(startTime: string, endTime: string) {
  try {
    localStorage.setItem(LAST_SLOT_KEY, JSON.stringify({ startTime, endTime }));
  } catch {
    // ignore inaccessible storage
  }
}

/**
 * Defaults a new block to start right where the day's last class ends (falling back to the
 * last slot used anywhere), keeping the same duration. Because times are plain minutes-since-
 * midnight arithmetic, a slot that crosses noon rolls from AM to PM on its own.
 */
function defaultTimeSlot(existingBlocksForDay: { endTime: string }[]) {
  const lastEndForDay = existingBlocksForDay.reduce<string | null>(
    (latest, b) => (latest === null || b.endTime > latest ? b.endTime : latest),
    null
  );
  const lastSlot = readLastTimeSlot();
  const startTime = lastEndForDay ?? lastSlot?.endTime ?? "09:00";
  const lastDuration = lastSlot ? timeToMinutes(lastSlot.endTime) - timeToMinutes(lastSlot.startTime) : 0;
  const duration = lastDuration > 0 ? lastDuration : DEFAULT_SLOT_DURATION_MINUTES;
  return { startTime, endTime: addMinutesToTime(startTime, duration) };
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type Subject = { id: string; name: string; color: string | null };

type Block = {
  id: string;
  subjectId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

export function StudentScheduleEditor({
  childId,
  subjects,
  schoolDays,
  blocks,
  canEdit,
}: {
  childId: string;
  subjects: Subject[];
  schoolDays: DayOfWeek[];
  blocks: Block[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<DayOfWeek>>(() => new Set([todayDayOfWeek()]));
  const allExpanded = expandedDays.size === DAYS_OF_WEEK.length;

  function toggleDayExpanded(day: DayOfWeek) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  function toggleAllExpanded() {
    setExpandedDays(allExpanded ? new Set() : new Set(DAYS_OF_WEEK));
  }

  async function toggleSchoolDay(day: DayOfWeek) {
    setError("");
    const next = schoolDays.includes(day)
      ? schoolDays.filter((d) => d !== day)
      : DAYS_OF_WEEK.filter((d) => schoolDays.includes(d) || d === day);
    try {
      await setSchoolDays(childId, next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update school days");
    }
  }

  return (
    <GameFrame
      title="Weekly Schedule"
      icon={<GameIcon name="calendar" className="size-5 text-[var(--gold-bright)]" />}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only a parent can change this schedule right now.
          </p>
        )}
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={toggleAllExpanded}>
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => (
            <DayRow
              key={day}
              childId={childId}
              day={day}
              isSchoolDay={schoolDays.includes(day)}
              subjects={subjects}
              blocks={blocks.filter((b) => b.dayOfWeek === day)}
              allBlocks={blocks}
              canEdit={canEdit}
              onToggleSchoolDay={() => toggleSchoolDay(day)}
              expanded={expandedDays.has(day)}
              onToggleExpanded={() => toggleDayExpanded(day)}
            />
          ))}
        </div>
      </div>
    </GameFrame>
  );
}

function DayRow({
  childId,
  day,
  isSchoolDay,
  subjects,
  blocks,
  allBlocks,
  canEdit,
  onToggleSchoolDay,
  expanded,
  onToggleExpanded,
}: {
  childId: string;
  day: DayOfWeek;
  isSchoolDay: boolean;
  subjects: Subject[];
  blocks: Block[];
  allBlocks: Block[];
  canEdit: boolean;
  onToggleSchoolDay: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "add" | "copy">("none");
  const [error, setError] = useState("");
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const otherDays = DAYS_OF_WEEK.filter((d) => d !== day).map((d) => ({
    day: d,
    count: allBlocks.filter((b) => b.dayOfWeek === d).length,
  }));

  async function handleRemove(blockId: string) {
    try {
      await deleteScheduleBlock(blockId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove class");
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        isSchoolDay ? "border-gold-dim bg-secondary/30" : "border-border/40 bg-muted/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          <h4 className="text-base font-medium">{DAY_LABELS[day]}</h4>
          {isSchoolDay && (
            <span className="text-xs text-muted-foreground">
              ({sorted.length} class{sorted.length === 1 ? "" : "es"})
            </span>
          )}
        </button>
        {canEdit ? (
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <span
              className={`text-sm font-medium ${isSchoolDay ? "text-foreground" : "text-muted-foreground"}`}
            >
              {isSchoolDay ? "School Day" : "Day Off"}
            </span>
            <Switch
              checked={isSchoolDay}
              onCheckedChange={onToggleSchoolDay}
              aria-label={`Toggle ${DAY_LABELS[day]} as a school day`}
            />
          </label>
        ) : (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              isSchoolDay ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {isSchoolDay ? "School Day" : "Day Off"}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
      )}

      {isSchoolDay && expanded && (
        <div className="mt-3 space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No classes scheduled.</p>
          )}
          {sorted.map((block) => {
            const subject = subjects.find((s) => s.id === block.subjectId);
            return (
              <div
                key={block.id}
                className="flex items-center gap-3 rounded-md border border-border/30 bg-background/40 px-3 py-2"
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subject?.color ?? "#6b7280" }}
                />
                <span className="flex-1 text-sm">{subject?.name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeOfDay(block.startTime)}&ndash;{formatTimeOfDay(block.endTime)}
                </span>
                {canEdit && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(block.id)}
                  >
                    ×
                  </Button>
                )}
              </div>
            );
          })}

          {canEdit && (
            <>
              {mode === "add" && (
                <AddBlockForm
                  childId={childId}
                  day={day}
                  subjects={subjects}
                  existingBlocks={sorted}
                  onDone={() => setMode("none")}
                  onError={setError}
                />
              )}
              {mode === "copy" && (
                <CopyDayForm
                  childId={childId}
                  day={day}
                  otherDays={otherDays}
                  onDone={() => setMode("none")}
                  onError={setError}
                />
              )}
              {mode === "none" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMode("add")}>
                    + Add Class
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMode("copy")}>
                    Copy Day
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddBlockForm({
  childId,
  day,
  subjects,
  existingBlocks,
  onDone,
  onError,
}: {
  childId: string;
  day: DayOfWeek;
  subjects: Subject[];
  existingBlocks: Block[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  const [subjectId, setSubjectId] = useState(sortedSubjects[0]?.id ?? "");
  const [defaults] = useState(() => defaultTimeSlot(existingBlocks));
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId) {
      onError("Add a subject for this hero first.");
      return;
    }
    if (startTime >= endTime) {
      onError("End time must be after start time.");
      return;
    }
    const alreadyScheduled = existingBlocks.some((b) => b.subjectId === subjectId);
    if (alreadyScheduled) {
      const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "This subject";
      if (!confirm(`${subjectName} is already scheduled on ${DAY_LABELS[day]}. Add it again?`)) {
        return;
      }
    }
    const conflict = existingBlocks.find((b) => timeRangesOverlap(startTime, endTime, b.startTime, b.endTime));
    if (conflict) {
      const conflictName = subjects.find((s) => s.id === conflict.subjectId)?.name ?? "another class";
      onError(
        `That overlaps with ${conflictName} (${formatTimeOfDay(conflict.startTime)}–${formatTimeOfDay(conflict.endTime)}).`
      );
      return;
    }

    setSaving(true);
    onError("");
    try {
      await createScheduleBlock(childId, { subjectId, dayOfWeek: day, startTime, endTime });
      writeLastTimeSlot(startTime, endTime);
      router.refresh();
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add class");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border/30 bg-background/40 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Subject</Label>
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {sortedSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Start</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CopyDayForm({
  childId,
  day,
  otherDays,
  onDone,
  onError,
}: {
  childId: string;
  day: DayOfWeek;
  otherDays: { day: DayOfWeek; count: number }[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const withBlocks = otherDays.filter((d) => d.count > 0);
  const [fromDay, setFromDay] = useState<DayOfWeek | "">(withBlocks[0]?.day ?? "");
  const [saving, setSaving] = useState(false);

  async function handleCopy() {
    if (!fromDay) return;
    if (
      !confirm(
        `Copy ${DAY_LABELS[fromDay]}'s schedule to ${DAY_LABELS[day]}? This will replace any classes currently on ${DAY_LABELS[day]}.`
      )
    ) {
      return;
    }
    setSaving(true);
    onError("");
    try {
      await copyScheduleBlocks(childId, fromDay, day);
      router.refresh();
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to copy schedule");
    } finally {
      setSaving(false);
    }
  }

  if (withBlocks.length === 0) {
    return (
      <div className="rounded-md border border-border/30 bg-background/40 p-3 text-sm text-muted-foreground">
        No other days have classes to copy yet.
        <div className="mt-2">
          <Button size="sm" variant="ghost" type="button" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/30 bg-background/40 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Copy from</Label>
        <Select value={fromDay} onChange={(e) => setFromDay(e.target.value as DayOfWeek)}>
          {withBlocks.map(({ day: d, count }) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]} ({count} class{count === 1 ? "" : "es"})
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="button" disabled={saving} onClick={handleCopy}>
          {saving ? "Copying..." : "Copy"}
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
