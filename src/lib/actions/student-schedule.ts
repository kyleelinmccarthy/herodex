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
import {
  DAYS_OF_WEEK,
  parseSchoolDays,
  parseStreakOptionalDays,
  findSlotConflict,
  type DayOfWeek,
} from "@/lib/utils/schedule-days";

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Rejects the two placements that genuinely can't work: a partial time overlap
 * (nothing could say which class a hero is in halfway through), and the same
 * subject twice in the identical slot.
 *
 * Two *different* subjects sharing the exact same slot is allowed on purpose —
 * see findSlotConflict. Without it, a parent whose day is already carved into
 * back-to-back blocks can't add a missing subject at all, which is what left
 * scheduled quests stranded with no class time to sit in.
 */
function assertSlotIsFree(
  sameDay: { subjectId: string; startTime: string; endTime: string }[],
  subjectId: string,
  startTime: string,
  endTime: string
) {
  const conflict = findSlotConflict(sameDay, { subjectId, startTime, endTime });
  if (!conflict) return;
  throw new Error(
    conflict.kind === "overlap"
      ? "This time overlaps part of another class. Use the exact same start and end time to share a slot, or pick a free time."
      : "That subject is already in this time slot."
  );
}

export async function getSchoolDays(childId: string): Promise<DayOfWeek[]> {
  await requireChildAccess(childId);
  const rows = await db
    .select({ schoolDays: schema.child.schoolDays })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  return parseSchoolDays(rows[0]?.schoolDays);
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

/** School days this hero may skip without breaking their streak. */
export async function getStreakOptionalDays(childId: string): Promise<DayOfWeek[]> {
  await requireChildAccess(childId);
  const rows = await db
    .select({ optionalDays: schema.child.streakOptionalDays })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  return parseStreakOptionalDays(rows[0]?.optionalDays);
}

export async function setStreakOptionalDay(childId: string, day: DayOfWeek, optional: boolean) {
  const { access } = await requireChildAccess(childId, { write: true });
  await assertCanEditScheduleContent(childId, access);
  if (!(DAYS_OF_WEEK as readonly string[]).includes(day)) {
    throw new Error("Unknown day of week.");
  }

  const rows = await db
    .select({ optionalDays: schema.child.streakOptionalDays })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  const current = parseStreakOptionalDays(rows[0]?.optionalDays);
  const next = optional
    ? DAYS_OF_WEEK.filter((d) => current.includes(d) || d === day)
    : current.filter((d) => d !== day);

  await db
    .update(schema.child)
    .set({ streakOptionalDays: JSON.stringify(next), updatedAt: new Date() })
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
    .select({
      subjectId: schema.scheduleBlock.subjectId,
      startTime: schema.scheduleBlock.startTime,
      endTime: schema.scheduleBlock.endTime,
    })
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, childId), eq(schema.scheduleBlock.dayOfWeek, data.dayOfWeek)));
  assertSlotIsFree(sameDay, data.subjectId, data.startTime, data.endTime);

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
    .select({
      id: schema.scheduleBlock.id,
      subjectId: schema.scheduleBlock.subjectId,
      startTime: schema.scheduleBlock.startTime,
      endTime: schema.scheduleBlock.endTime,
    })
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, existing.childId), eq(schema.scheduleBlock.dayOfWeek, dayOfWeek)));
  assertSlotIsFree(
    sameDay.filter((b) => b.id !== blockId),
    data.subjectId ?? existing.subjectId,
    startTime,
    endTime
  );

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

/**
 * Retimes every class sharing one time slot, together.
 *
 * A slot with two subjects can't be moved a block at a time: the first update
 * lands on the new time while its slot-mate is still on the old one, and the
 * two then partially overlap — so the move rejects itself halfway through.
 * Validating the destination once, against only the blocks *outside* the slot,
 * is the only way a shared slot can be dragged anywhere at all.
 */
export async function updateScheduleSlotTime(
  childId: string,
  dayOfWeek: DayOfWeek,
  slot: { startTime: string; endTime: string },
  next: { startTime: string; endTime: string }
) {
  const { access } = await requireChildAccess(childId, { write: true });
  await assertCanEditScheduleContent(childId, access);

  if (!isValidTime(next.startTime) || !isValidTime(next.endTime)) {
    throw new Error("Times must be in HH:mm format.");
  }
  if (next.startTime >= next.endTime) {
    throw new Error("End time must be after start time.");
  }

  const sameDay = await db
    .select({
      id: schema.scheduleBlock.id,
      subjectId: schema.scheduleBlock.subjectId,
      startTime: schema.scheduleBlock.startTime,
      endTime: schema.scheduleBlock.endTime,
    })
    .from(schema.scheduleBlock)
    .where(and(eq(schema.scheduleBlock.childId, childId), eq(schema.scheduleBlock.dayOfWeek, dayOfWeek)));

  const inSlot = sameDay.filter(
    (b) => b.startTime === slot.startTime && b.endTime === slot.endTime
  );
  if (inSlot.length === 0) throw new Error("That time slot no longer exists.");

  const others = sameDay.filter(
    (b) => !(b.startTime === slot.startTime && b.endTime === slot.endTime)
  );
  for (const block of inSlot) {
    assertSlotIsFree(others, block.subjectId, next.startTime, next.endTime);
  }

  const now = new Date();
  for (const block of inSlot) {
    await db
      .update(schema.scheduleBlock)
      .set({ startTime: next.startTime, endTime: next.endTime, updatedAt: now })
      .where(eq(schema.scheduleBlock.id, block.id));
  }
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
