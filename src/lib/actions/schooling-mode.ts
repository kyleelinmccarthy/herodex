"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireChildAccess, isChildActor } from "@/lib/auth/access";
import { weekdayOfDate, type DayOfWeek } from "@/lib/utils/schedule-days";
import {
  getEffectiveSchoolingMode,
  parseSchoolingModeOverrides,
  type SchoolingMode,
} from "@/lib/utils/schooling-mode";

export async function getSchoolingModeSettings(childId: string): Promise<{
  schoolingMode: SchoolingMode;
  overrides: Partial<Record<DayOfWeek, SchoolingMode>>;
}> {
  await requireChildAccess(childId);
  const rows = await db
    .select({ mode: schema.child.schoolingMode, overrides: schema.child.schoolingModeOverrides })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  return {
    schoolingMode: (rows[0]?.mode as SchoolingMode) ?? "unstructured",
    overrides: parseSchoolingModeOverrides(rows[0]?.overrides ?? null),
  };
}

/** Effective mode for a specific ISO date — used by the tavern/quests pages and quest-assignments.ts. */
export async function getSchoolingModeForDate(childId: string, date: string): Promise<SchoolingMode> {
  const { schoolingMode, overrides } = await getSchoolingModeSettings(childId);
  return getEffectiveSchoolingMode(schoolingMode, overrides, weekdayOfDate(date));
}

export async function setSchoolingMode(childId: string, mode: SchoolingMode) {
  const { access } = await requireChildAccess(childId, { write: true });
  if (isChildActor(access)) {
    throw new Error("Only a parent can change schooling mode.");
  }
  await db
    .update(schema.child)
    .set({ schoolingMode: mode, updatedAt: new Date() })
    .where(eq(schema.child.id, childId));
}

export async function setSchoolingModeOverride(childId: string, day: DayOfWeek, mode: SchoolingMode | null) {
  const { access } = await requireChildAccess(childId, { write: true });
  if (isChildActor(access)) {
    throw new Error("Only a parent can change schooling mode.");
  }
  const rows = await db
    .select({ overrides: schema.child.schoolingModeOverrides })
    .from(schema.child)
    .where(eq(schema.child.id, childId))
    .limit(1);
  const current = parseSchoolingModeOverrides(rows[0]?.overrides ?? null);
  if (mode === null) {
    delete current[day];
  } else {
    current[day] = mode;
  }
  await db
    .update(schema.child)
    .set({ schoolingModeOverrides: JSON.stringify(current), updatedAt: new Date() })
    .where(eq(schema.child.id, childId));
}
