"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteActivity, updateActivity } from "@/lib/actions/activities";
import { GameIcon } from "@/components/game-icon";
import { useState } from "react";

type Activity = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number | null;
  description: string | null;
  subjectId: string;
};

type Subject = {
  id: string;
  name: string;
  color: string | null;
};

export function QuestLog({
  activities,
  subjects,
}: {
  activities: Activity[];
  subjects: Subject[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const parsedEditDuration = parseInt(editDuration, 10);
  const isEditDurationValid =
    editDuration.trim() !== "" && Number.isFinite(parsedEditDuration) && parsedEditDuration >= 1 && parsedEditDuration <= 480;

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteActivity(id);
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(activity: Activity) {
    setEditingId(activity.id);
    setEditDuration(activity.durationMinutes ? String(activity.durationMinutes) : "");
  }

  async function handleSaveEdit(id: string) {
    if (!isEditDurationValid) return;
    setSavingEdit(true);
    try {
      await updateActivity(id, { durationMinutes: parsedEditDuration });
      setEditingId(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  if (activities.length === 0) {
    return (
      <div className="py-6 text-center">
        <GameIcon name="scroll" className="mx-auto size-8 text-[var(--gold-bright)]" />
        <p className="mt-2 text-sm text-muted-foreground">No quests chronicled yet. The adventure beckons, brave one!</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, Activity[]>();
  for (const a of activities) {
    const list = grouped.get(a.date) ?? [];
    list.push(a);
    grouped.set(a.date, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dayActivities]) => (
        <div key={date}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--gold-bright)" }}>
            <GameIcon name="calendar" className="size-4 text-[var(--gold-bright)]" />
            {date}
          </h3>
          <div className="space-y-2">
            {dayActivities.map((activity) => {
              const subject = subjectMap.get(activity.subjectId);
              return (
                <div
                  key={activity.id}
                  className="quest-item flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="quest-dot"
                      style={{
                        backgroundColor: subject?.color ?? "#6b7280",
                        "--dot-glow": `${subject?.color ?? "#6b7280"}80`,
                      } as React.CSSProperties}
                    />
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      {editingId === activity.id ? (
                        <div className="mt-1 flex items-center gap-2">
                          <Input
                            type="number"
                            value={editDuration}
                            onChange={(e) => setEditDuration(e.target.value)}
                            min={1}
                            max={480}
                            required
                            className="h-7 w-20"
                            aria-label="Duration in minutes"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {subject?.name ?? "Unknown"}
                          {activity.durationMinutes ? ` · ${activity.durationMinutes} min` : ""}
                          {activity.description ? ` · ${activity.description}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {editingId === activity.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(activity.id)}
                          disabled={savingEdit || !isEditDurationValid}
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          disabled={savingEdit}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(activity)}
                          className="text-muted-foreground"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(activity.id)}
                          disabled={deleting === activity.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deleting === activity.id ? "..." : "×"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
