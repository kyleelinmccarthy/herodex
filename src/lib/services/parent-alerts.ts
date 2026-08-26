import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Raising in-app notices for the grown-ups. A hero acting on their own quests
 * is the only source today: a parent who hands over skipping still gets told
 * every time it's used, so "allowed" never means "unnoticed" — and a hero who
 * gets stuck and moves on always raises one, whether or not skipping was ever
 * handed over.
 *
 * Plain module, not a "use server" action file — the caller has already
 * authorized the assignment it's alerting about.
 */

export type QuestAlertType = "quest_skipped" | "quest_stuck";

/**
 * Records that a hero skipped one of their own quests, or got stuck on one and
 * moved past it. Everything the alert shows is copied in here, so it still
 * reads correctly once the quest is renamed — or removed, taking its
 * assignment row with it.
 */
export async function recordQuestAlert(
  assignmentId: string,
  type: QuestAlertType,
  /** Why the hero set the quest aside. Always given — skipping and getting
   *  stuck both require a reason — and it is the part of the alert a grown-up
   *  can actually act on. */
  note: string
) {
  const rows = await db
    .select({
      assignmentId: schema.questAssignment.id,
      date: schema.questAssignment.date,
      childId: schema.child.id,
      childName: schema.child.displayName,
      familyId: schema.child.familyId,
      questTitle: schema.quest.title,
      subjectName: schema.subject.name,
    })
    .from(schema.questAssignment)
    .innerJoin(schema.quest, eq(schema.questAssignment.questId, schema.quest.id))
    .innerJoin(schema.child, eq(schema.questAssignment.childId, schema.child.id))
    .leftJoin(schema.subject, eq(schema.quest.subjectId, schema.subject.id))
    .where(eq(schema.questAssignment.id, assignmentId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  await db.insert(schema.parentAlert).values({
    id: nanoid(),
    familyId: row.familyId,
    childId: row.childId,
    type,
    questAssignmentId: row.assignmentId,
    childName: row.childName,
    questTitle: row.questTitle,
    subjectName: row.subjectName,
    date: row.date,
    note: note.trim() || null,
    createdAt: new Date(),
  });
}
