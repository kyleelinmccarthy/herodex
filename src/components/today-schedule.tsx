import { QuestAssignmentCard } from "@/components/quest-assignment-card";
import { formatTimeOfDay } from "@/lib/utils/schedule-days";

type ScheduleBlock = {
  id: string;
  subjectId: string;
  startTime: string;
  endTime: string;
};

type Subject = {
  id: string;
  name: string;
  color: string | null;
};

type AssignmentWithDetails = {
  assignment: { id: string; status: string; notes: string | null };
  quest: {
    id: string;
    title: string;
    description: string | null;
    estimatedMinutes: number | null;
    rewardXp: number | null;
    rewardDescription: string | null;
    rewardAvatarItem: string | null;
    requireNotes: boolean;
  };
  subject: { id: string; name: string; color: string | null };
};

/**
 * Lays today's assignments over today's class-time blocks, so a hero sees
 * what to do *when* rather than an unordered pile of quests to sort out
 * themselves.
 */
export function TodaySchedule({
  blocks,
  subjects,
  assignments,
  isChildView,
}: {
  blocks: ScheduleBlock[];
  subjects: Subject[];
  assignments: AssignmentWithDetails[];
  isChildView: boolean;
}) {
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  const assignmentsBySubject = new Map<string, AssignmentWithDetails[]>();
  for (const a of assignments) {
    const list = assignmentsBySubject.get(a.subject.id) ?? [];
    list.push(a);
    assignmentsBySubject.set(a.subject.id, list);
  }

  const scheduledSubjectIds = new Set(blocks.map((b) => b.subjectId));
  const unscheduled = assignments.filter((a) => !scheduledSubjectIds.has(a.subject.id));

  const shownSubjectIds = new Set<string>();

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const subject = subjectsById.get(block.subjectId);
        const alreadyShown = shownSubjectIds.has(block.subjectId);
        const blockAssignments = alreadyShown ? [] : assignmentsBySubject.get(block.subjectId) ?? [];
        if (!alreadyShown) shownSubjectIds.add(block.subjectId);

        return (
          <div key={block.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: subject?.color ?? "#6b7280" }}
              />
              <span className="text-xs font-semibold text-muted-foreground">
                {formatTimeOfDay(block.startTime)}–{formatTimeOfDay(block.endTime)}
              </span>
              <span className="text-xs text-muted-foreground">{subject?.name ?? "Unknown subject"}</span>
            </div>
            {blockAssignments.length > 0 ? (
              <div className="space-y-2 pl-4">
                {blockAssignments.map((a) => (
                  <QuestAssignmentCard key={a.assignment.id} data={a} isChildView={isChildView} />
                ))}
              </div>
            ) : (
              <p className="pl-4 text-xs italic text-muted-foreground">
                {alreadyShown ? "Same subject as above" : "No quest assigned for this time yet"}
              </p>
            )}
          </div>
        );
      })}

      {unscheduled.length > 0 && (
        <div className="space-y-2 border-t border-border/30 pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Unscheduled</p>
          <div className="space-y-2">
            {unscheduled.map((a) => (
              <QuestAssignmentCard key={a.assignment.id} data={a} isChildView={isChildView} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
