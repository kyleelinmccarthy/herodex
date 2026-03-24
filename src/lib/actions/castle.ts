"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireParentUserId } from "@/lib/auth/session";
import { nanoid } from "nanoid";
import { CASTLE_TYPES } from "@/lib/utils/avatar-catalog";

export async function getCastle(childId: string) {
  const rows = await db
    .select()
    .from(schema.castle)
    .where(eq(schema.castle.childId, childId))
    .limit(1);
  return rows[0] ?? null;
}

export async function initializeCastle(childId: string) {
  const parentUserId = await requireParentUserId();

  // Verify child belongs to parent's family
  const familyRows = await db
    .select({ id: schema.family.id })
    .from(schema.family)
    .where(eq(schema.family.parentUserId, parentUserId))
    .limit(1);
  if (!familyRows[0]) throw new Error("No family found.");

  const childRows = await db
    .select()
    .from(schema.child)
    .where(and(eq(schema.child.id, childId), eq(schema.child.familyId, familyRows[0].id)))
    .limit(1);
  if (!childRows[0]) throw new Error("Child not found.");

  const level = Math.floor(childRows[0].currentXp / 100) + 1;
  if (level < 50) throw new Error("Must be level 50 to unlock a castle.");

  // Check if castle already exists
  const existing = await getCastle(childId);
  if (existing) return existing;

  const now = new Date();
  const castle = {
    id: nanoid(),
    childId,
    type: "campsite",
    name: `${childRows[0].displayName}'s Castle`,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.castle).values(castle);
  revalidatePath("/castle");
  return castle;
}

export async function upgradeCastle(childId: string, newType: string) {
  const parentUserId = await requireParentUserId();

  const familyRows = await db
    .select({ id: schema.family.id })
    .from(schema.family)
    .where(eq(schema.family.parentUserId, parentUserId))
    .limit(1);
  if (!familyRows[0]) throw new Error("No family found.");

  const childRows = await db
    .select()
    .from(schema.child)
    .where(and(eq(schema.child.id, childId), eq(schema.child.familyId, familyRows[0].id)))
    .limit(1);
  if (!childRows[0]) throw new Error("Child not found.");

  const level = Math.floor(childRows[0].currentXp / 100) + 1;

  const castleType = CASTLE_TYPES.find((t) => t.id === newType);
  if (!castleType) throw new Error("Invalid castle type.");
  if (level < castleType.levelRequired) {
    throw new Error(`Must be level ${castleType.levelRequired} to upgrade to ${castleType.label}.`);
  }

  await db
    .update(schema.castle)
    .set({ type: newType, updatedAt: new Date() })
    .where(eq(schema.castle.childId, childId));

  revalidatePath("/castle");
}

export async function renameCastle(childId: string, newName: string) {
  const parentUserId = await requireParentUserId();

  const familyRows = await db
    .select({ id: schema.family.id })
    .from(schema.family)
    .where(eq(schema.family.parentUserId, parentUserId))
    .limit(1);
  if (!familyRows[0]) throw new Error("No family found.");

  const trimmed = newName.trim().slice(0, 50);
  if (!trimmed) throw new Error("Castle name cannot be empty.");

  await db
    .update(schema.castle)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(schema.castle.childId, childId));

  revalidatePath("/castle");
}
