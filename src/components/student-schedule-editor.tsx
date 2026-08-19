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
  createScheduleBlock,
  deleteScheduleBlock,
  setSchoolDays,
} from "@/lib/actions/student-schedule";
import { DAYS_OF_WEEK, timeRangesOverlap, type DayOfWeek } from "@/lib/utils/schedule-days";

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
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => (
            <DayRow
              key={day}
              childId={childId}
              day={day}
              isSchoolDay={schoolDays.includes(day)}
              subjects={subjects}
              blocks={blocks.filter((b) => b.dayOfWeek === day)}
              canEdit={canEdit}
              onToggleSchoolDay={() => toggleSchoolDay(day)}
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
  canEdit,
  onToggleSchoolDay,
}: {
  childId: string;
  day: DayOfWeek;
  isSchoolDay: boolean;
  subjects: Subject[];
  blocks: Block[];
  canEdit: boolean;
  onToggleSchoolDay: () => void;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));

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
        <h4 className="text-base font-medium">{DAY_LABELS[day]}</h4>
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

      {isSchoolDay && (
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
                  {block.startTime}&ndash;{block.endTime}
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
              {showAdd ? (
                <AddBlockForm
                  childId={childId}
                  day={day}
                  subjects={subjects}
                  existingBlocks={sorted}
                  onDone={() => setShowAdd(false)}
                  onError={setError}
                />
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                  + Add Class
                </Button>
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
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:45");
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
      onError(`That overlaps with ${conflictName} (${conflict.startTime}–${conflict.endTime}).`);
      return;
    }

    setSaving(true);
    onError("");
    try {
      await createScheduleBlock(childId, { subjectId, dayOfWeek: day, startTime, endTime });
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
          {subjects.map((s) => (
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
