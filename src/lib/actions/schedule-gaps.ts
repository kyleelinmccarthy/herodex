"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireChildAccess } from "@/lib/auth/access";
import { parseSchoolDays } from "@/lib/utils/schedule-days";
import { findSubjectScheduleGaps, type SubjectScheduleGap } from "@/lib/utils/schedule-gaps";

/**
 * Subjects whose scheduled quests land on days they have no class time.
 *
 * A quest's repeat and the weekly schedule are joined only by subject, so a
 * parent can put a Tuesday quest on a subject with no Tuesday class. The
 * assignment is still generated — it just has nowhere on the day to sit, and
 * structured mode drops it behind everything that does. This is what lets the
 * parent surfaces say so instead of leaving them to notice.
 */
export async function getSubjectScheduleGaps(childId: string): Promise<SubjectScheduleGap[]> {
  await requireChildAccess(childId);

  const [scheduledQuests, blocks, childRows] = await Promise.all([
    db
      .select({
        id: schema.quest.id,
        title: schema.quest.title,
        subjectId: schema.quest.subjectId,
        subjectName: schema.subject.name,
        schedule: schema.questSchedule,
      })
      .from(schema.quest)
      .innerJoin(schema.questSchedule, eq(schema.questSchedule.questId, schema.quest.id))
      .innerJoin(schema.subject, eq(schema.subject.id, schema.quest.subjectId))
      .where(and(eq(schema.quest.childId, childId), eq(schema.quest.isActive, true))),
    db
      .select({
        subjectId: schema.scheduleBlock.subjectId,
        dayOfWeek: schema.scheduleBlock.dayOfWeek,
      })
      .from(schema.scheduleBlock)
      .where(eq(schema.scheduleBlock.childId, childId)),
    db
      .select({ schoolDays: schema.child.schoolDays })
      .from(schema.child)
      .where(eq(schema.child.id, childId))
      .limit(1),
  ]);

  return findSubjectScheduleGaps({
    quests: scheduledQuests.map((q) => ({
      id: q.id,
      title: q.title,
      subjectId: q.subjectId,
      subjectName: q.subjectName,
      repeat: {
        frequency: q.schedule.frequency,
        daysOfWeek: q.schedule.daysOfWeek,
        intervalWeeks: q.schedule.intervalWeeks,
        startDate: q.schedule.startDate,
        endDate: q.schedule.endDate,
      },
    })),
    blocks,
    schoolDays: parseSchoolDays(childRows[0]?.schoolDays),
  });
}
