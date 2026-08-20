"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GameFrame } from "@/components/game-frame";
import { GameIcon } from "@/components/game-icon";
import { QuestTemplateForm } from "./quest-template-form";
import { deleteQuest } from "@/lib/actions/quests";

const HIDE_COMPLETED_KEY = "kingdomsandcrowns-hide-completed-quests";

type Subject = { id: string; name: string; color: string | null };

type Quest = {
  id: string;
  title: string;
  subjectId: string;
  description: string | null;
  estimatedMinutes: number | null;
  rewardXp: number | null;
  rewardDescription: string | null;
  rewardAvatarItem: string | null;
};

type Schedule = {
  id: string;
  questId: string;
  frequency: string;
  daysOfWeek: string | null;
  intervalWeeks: number | null;
  startDate: string;
  endDate: string | null;
};

type AssignmentStatus = { status: string; date: string };

export function QuestTemplateList({
  childId,
  quests,
  subjects,
  childUnlockedItems = [],
  schedules = [],
  schoolDays,
  assignmentStatusByQuest = {},
}: {
  childId: string;
  quests: Quest[];
  subjects: Subject[];
  childUnlockedItems?: string[];
  schedules?: Schedule[];
  schoolDays: string[];
  assignmentStatusByQuest?: Record<string, AssignmentStatus>;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(HIDE_COMPLETED_KEY);
    if (stored !== null) setHideCompleted(stored === "true");
  }, []);

  function toggleHideCompleted(checked: boolean) {
    setHideCompleted(checked);
    localStorage.setItem(HIDE_COMPLETED_KEY, String(checked));
  }

  const scheduleByQuestId = new Map(schedules.map((s) => [s.questId, s]));

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const assignedAvatarItems = quests
    .filter((q) => q.rewardAvatarItem)
    .map((q) => q.rewardAvatarItem!);

  // A quest is "completed" for filtering purposes only when it's a one-time
  // (non-repeating) quest whose sole assignment has been completed. Repeating
  // quests reset each cycle, so they're never hidden by this toggle.
  const visibleQuests = quests.filter((q) => {
    if (!hideCompleted) return true;
    const isRepeating = scheduleByQuestId.has(q.id);
    if (isRepeating) return true;
    return assignmentStatusByQuest[q.id]?.status !== "completed";
  });

  // Group quests by subject
  const grouped = new Map<string, Quest[]>();
  for (const q of visibleQuests) {
    const list = grouped.get(q.subjectId) ?? [];
    list.push(q);
    grouped.set(q.subjectId, list);
  }

  async function handleDelete(questId: string) {
    await deleteQuest(questId);
    router.refresh();
  }

  return (
    <>
      <GameFrame
        title="Assigned Quests"
        icon={<GameIcon name="scroll" className="size-5 text-[var(--gold-bright)]" />}
        action={<Button size="sm" onClick={() => setShowAdd(true)}>New Quest</Button>}
      >
        {quests.length > 0 && (
          <label className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => toggleHideCompleted(e.target.checked)}
            />
            Hide completed quests
          </label>
        )}
        {quests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quests created yet. Create your first quest scroll to begin planning adventures!
          </p>
        ) : visibleQuests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All quests are completed. Uncheck &quot;Hide completed quests&quot; to see them.
          </p>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([subjectId, subjectQuests]) => {
              const subject = subjectMap.get(subjectId);
              return (
                <div key={subjectId}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: subject?.color ?? "#6b7280" }}
                    />
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {subject?.name ?? "Unknown"}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {subjectQuests.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between rounded-md border border-border/50 bg-card/50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/scrolls/${q.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {q.title}
                          </Link>
                          {q.estimatedMinutes && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ~{q.estimatedMinutes}min
                            </span>
                          )}
                          {q.description && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {q.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-2 flex shrink-0 gap-1">
                          <Button size="sm" variant="outline" className="!border-[var(--gold-border)] hover:!border-[var(--gold-bright)]" onClick={() => setEditingQuest(q)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="!border-[var(--gold-border)] hover:!border-[var(--gold-bright)]" onClick={() => handleDelete(q.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GameFrame>

      <QuestTemplateForm
        childId={childId}
        subjects={subjects}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        childUnlockedItems={childUnlockedItems}
        assignedAvatarItems={assignedAvatarItems}
        schoolDays={schoolDays}
      />

      {editingQuest && (
        <QuestTemplateForm
          childId={childId}
          subjects={subjects}
          quest={editingQuest}
          schedule={scheduleByQuestId.get(editingQuest.id) ?? null}
          open={true}
          onClose={() => setEditingQuest(null)}
          childUnlockedItems={childUnlockedItems}
          assignedAvatarItems={assignedAvatarItems}
          schoolDays={schoolDays}
        />
      )}
    </>
  );
}
