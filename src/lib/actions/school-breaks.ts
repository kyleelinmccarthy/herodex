"use server";

import { nanoid } from "nanoid";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sanitizeName } from "@/lib/utils/sanitize";

export async function getSchoolBreaks(familyId: string) {
  return db
    .select()
    .from(schema.schoolBreak)
    .where(eq(schema.schoolBreak.familyId, familyId))
    .orderBy(asc(schema.schoolBreak.startDate));
}

export async function createSchoolBreak(
  familyId: string,
  name: string,
  startDate: string,
  endDate: string
) {
  const cleanName = sanitizeName(name);
  if (!cleanName) throw new Error("Break name is required");
  if (startDate > endDate) throw new Error("Start date must be before end date");

  const id = nanoid();
  const now = new Date();
  await db.insert(schema.schoolBreak).values({
    id,
    familyId,
    name: cleanName,
    startDate,
    endDate,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

export async function deleteSchoolBreak(breakId: string) {
  await db
    .delete(schema.schoolBreak)
    .where(eq(schema.schoolBreak.id, breakId));
}
