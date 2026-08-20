"use server";

import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  requireChildAccess,
  requireScheduleBlockAccess,
  assertCanEditScheduleContent,
  isChildActor,
} from "@/lib/auth/access";
import { DAYS_OF_WEEK, timeRangesOverlap, type DayOfWeek } from "@/lib/utils/schedule-days";

const DEFAULT_SCHOOL_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri"];

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function getSchoolDays(childId: string): Promise<DayOfWeek[]> {
  await requireChildAccess(childId);
  const rows = await db
    .select({ schoolDays: schema.child.schoolDays })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  const raw = rows[0]?.schoolDays;
  if (!raw) return DEFAULT_SCHOOL_DAYS;
  try {
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((d): d is DayOfWeek => (DAYS_OF_WEEK as readonly string[]).includes(d));
    return valid.length > 0 ? valid : DEFAULT_SCHOOL_DAYS;
  } catch {
    return DEFAULT_SCHOOL_DAYS;
  }
}

export async function setSchoolDays(childId: string, days: DayOfWeek[]) {
  const { access } = await requireChildAccess(childId, { write: true });
  await assertCanEditScheduleContent(childId, access);

  const clean = days.filter((d) => (DAYS_OF_WEEK as readonly string[]).includes(d));
  await db
    .update(schema.child)
    .set({ schoolDays: JSON.stringify(clean), updatedAt: new Date() })
    .where(eq(schema.child.id, childId));
}

export async function getScheduleBlocks(childId: string) {
  await requireChildAccess(childId);
  const rows = await db
    .select()
    .from(schema.scheduleBlock)
    .where(eq(schema.scheduleBlock.childId, childId));
  return rows.sort((a, b) =>
    a.dayOfWeek === b.dayOfWeek
      ? a.startTime.localeCompare(b.startTime)
      : DAYS_OF_WEEK.indexOf(a.dayOfWeek as DayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek as DayOfWeek)
  );
}

export async function createScheduleBlock(
  childId: string,
  data: { subjectId: string; dayOfWeek: DayOfWeek; startTime: string; endTime: string }
) {
  const { access } = await requireChildAccess(childId, { write: true });
  await assertCanEditScheduleContent(childId, access);

  if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) {
    throw new Error("Times must be in HH:mm format.");
  }
  if (data.startTime >= data.endTime) {
    throw new Error("End time must be after start time.");
  }

  const subjectRows = await db
    .select({ id: schema.subject.id })
    .from(schema.subject)
    .where(and(eq(schema.subject.id, data.subjectId), eq(schema.subject.childId, childId)))
    .limit(1);
  if (!subjectRows[0]) throw new Error("Subject not found for this hero.");

  const sameDay = await db
    .select({ startTime: schema.scheduleBlock.startTime, endTime: schema.scheduleBlock.endTime })
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, childId), eq(schema.scheduleBlock.dayOfWeek, data.dayOfWeek)));
  if (sameDay.some((b) => timeRangesOverlap(data.startTime, data.endTime, b.startTime, b.endTime))) {
    throw new Error("This time overlaps with another class already on this day.");
  }

  const id = nanoid();
  const now = new Date();
  await db.insert(schema.scheduleBlock).values({
    id,
    childId,
    subjectId: data.subjectId,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

export async function updateScheduleBlock(
  blockId: string,
  data: { subjectId?: string; dayOfWeek?: DayOfWeek; startTime?: string; endTime?: string }
) {
  const { access } = await requireScheduleBlockAccess(blockId, { write: true });
  const rows = await db
    .select()
    .from(schema.scheduleBlock)
    .where(eq(schema.scheduleBlock.id, blockId))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw new Error("Schedule block not found.");
  await assertCanEditScheduleContent(existing.childId, access);

  const startTime = data.startTime ?? existing.startTime;
  const endTime = data.endTime ?? existing.endTime;
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new Error("Times must be in HH:mm format.");
  }
  if (startTime >= endTime) {
    throw new Error("End time must be after start time.");
  }

  if (data.subjectId) {
    const subjectRows = await db
      .select({ id: schema.subject.id })
      .from(schema.subject)
      .where(and(eq(schema.subject.id, data.subjectId), eq(schema.subject.childId, existing.childId)))
      .limit(1);
    if (!subjectRows[0]) throw new Error("Subject not found for this hero.");
  }

  const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const sameDay = await db
    .select({ id: schema.scheduleBlock.id, startTime: schema.scheduleBlock.startTime, endTime: schema.scheduleBlock.endTime })
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, existing.childId), eq(schema.scheduleBlock.dayOfWeek, dayOfWeek)));
  if (
    sameDay.some(
      (b) => b.id !== blockId && timeRangesOverlap(startTime, endTime, b.startTime, b.endTime)
    )
  ) {
    throw new Error("This time overlaps with another class already on this day.");
  }

  await db
    .update(schema.scheduleBlock)
    .set({
      subjectId: data.subjectId ?? existing.subjectId,
      dayOfWeek,
      startTime,
      endTime,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduleBlock.id, blockId));
}

export async function copyScheduleBlocks(childId: string, fromDay: DayOfWeek, toDay: DayOfWeek) {
  const { access } = await requireChildAccess(childId, { write: true });
  await assertCanEditScheduleContent(childId, access);

  if (fromDay === toDay) {
    throw new Error("Pick a different day to copy from.");
  }

  const sourceBlocks = await db
    .select()
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, childId), eq(schema.scheduleBlock.dayOfWeek, fromDay)));
  if (sourceBlocks.length === 0) {
    throw new Error("That day has no classes to copy.");
  }

  await db
    .delete(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, childId), eq(schema.scheduleBlock.dayOfWeek, toDay)));

  const now = new Date();
  await db.insert(schema.scheduleBlock).values(
    sourceBlocks.map((b) => ({
      id: nanoid(),
      childId,
      subjectId: b.subjectId,
      dayOfWeek: toDay,
      startTime: b.startTime,
      endTime: b.endTime,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export async function deleteScheduleBlock(blockId: string) {
  const { access } = await requireScheduleBlockAccess(blockId, { write: true });
  const rows = await db
    .select({ childId: schema.scheduleBlock.childId })
    .from(schema.scheduleBlock)
    .where(eq(schema.scheduleBlock.id, blockId))
    .limit(1);
  if (!rows[0]) return;
  await assertCanEditScheduleContent(rows[0].childId, access);

  await db.delete(schema.scheduleBlock).where(eq(schema.scheduleBlock.id, blockId));
}

export async function getScheduleSelfManage(childId: string): Promise<boolean> {
  await requireChildAccess(childId);
  const rows = await db
    .select({ enabled: schema.child.scheduleSelfManageEnabled })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  return rows[0]?.enabled ?? false;
}

export async function setScheduleSelfManage(childId: string, enabled: boolean) {
  const { access } = await requireChildAccess(childId, { write: true });
  if (isChildActor(access)) {
    throw new Error("Only a parent can change who manages this schedule.");
  }
  await db
    .update(schema.child)
    .set({ scheduleSelfManageEnabled: enabled, updatedAt: new Date() })
    .where(eq(schema.child.id, childId));
}
