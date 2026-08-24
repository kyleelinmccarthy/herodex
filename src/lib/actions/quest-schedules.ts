"use server";

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireChildAccess, requireQuestAccess } from "@/lib/auth/access";

export async function getSchedulesForChild(childId: string) {
  await requireChildAccess(childId);
  const rows = await db
    .select({ schedule: schema.questSchedule })
    .from(schema.questSchedule)
    .innerJoin(schema.quest, eq(schema.quest.id, schema.questSchedule.questId))
    .where(eq(schema.quest.childId, childId));
  return rows.map((r) => r.schedule);
}

export async function getSchedule(questId: string) {
  await requireQuestAccess(questId);
  const rows = await db
    .select()
    .from(schema.questSchedule)
    .where(eq(schema.questSchedule.questId, questId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSchedule(
  questId: string,
  data: {
    frequency: "once" | "daily" | "weekly" | "monthly";
    daysOfWeek?: string[];
    intervalWeeks?: number;
    startDate: string;
    endDate?: string;
  }
) {
  await requireQuestAccess(questId, { write: true });
  const existing = await getSchedule(questId);

  const values = {
    frequency: data.frequency,
    daysOfWeek: data.frequency === "weekly" && data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
    intervalWeeks: data.frequency === "weekly" ? (data.intervalWeeks ?? 1) : null,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
  };

  if (existing) {
    await db
      .update(schema.questSchedule)
      .set(values)
      .where(eq(schema.questSchedule.id, existing.id));
    return { id: existing.id };
  }

  const id = nanoid();
  await db.insert(schema.questSchedule).values({
    id,
    questId,
    ...values,
    createdAt: new Date(),
  });
  return { id };
}

export async function deleteSchedule(questId: string) {
  await requireQuestAccess(questId, { write: true });
  await db
    .delete(schema.questSchedule)
    .where(eq(schema.questSchedule.questId, questId));
}
