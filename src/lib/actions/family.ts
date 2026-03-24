"use server";

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireSession, requireParentUserId } from "@/lib/auth/session";
import { sanitizeName } from "@/lib/utils/sanitize";

export async function getFamily() {
  const parentUserId = await requireParentUserId();
  const rows = await db
    .select()
    .from(schema.family)
    .where(eq(schema.family.parentUserId, parentUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createFamily(familyName: string, timezone?: string) {
  const parentUserId = await requireParentUserId();
  const now = new Date();
  const id = nanoid();
  const name = sanitizeName(familyName);
  if (!name) throw new Error("Family name is required");

  await db.insert(schema.family).values({
    id,
    parentUserId,
    familyName: name,
    timezone: timezone ?? "America/Denver",
    createdAt: now,
    updatedAt: now,
  });

  return { id, familyName: name };
}

export async function updateFamily(familyName: string, timezone?: string) {
  const parentUserId = await requireParentUserId();
  const name = sanitizeName(familyName);
  if (!name) throw new Error("Family name is required");

  await db
    .update(schema.family)
    .set({ familyName: name, timezone: timezone ?? undefined, updatedAt: new Date() })
    .where(eq(schema.family.parentUserId, parentUserId));
}
