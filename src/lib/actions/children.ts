"use server";

import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireParentUserId } from "@/lib/auth/session";
import { sanitizeName } from "@/lib/utils/sanitize";
import { hashPin } from "@/lib/utils/pin";
import { deriveAgeMode } from "@/lib/utils/age-mode";

async function getFamilyIdForUser() {
  const parentUserId = await requireParentUserId();
  const rows = await db
    .select({ id: schema.family.id })
    .from(schema.family)
    .where(eq(schema.family.parentUserId, parentUserId))
    .limit(1);
  if (!rows[0]) throw new Error("No family found. Create a family first.");
  return rows[0].id;
}

export async function getChildren() {
  const familyId = await getFamilyIdForUser();
  return db
    .select()
    .from(schema.child)
    .where(eq(schema.child.familyId, familyId));
}

export async function getChild(childId: string) {
  const familyId = await getFamilyIdForUser();
  const rows = await db
    .select()
    .from(schema.child)
    .where(and(eq(schema.child.id, childId), eq(schema.child.familyId, familyId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createChild(data: {
  displayName: string;
  birthYear: number;
  pin: string;
}) {
  const familyId = await getFamilyIdForUser();
  const now = new Date();
  const id = nanoid();
  const name = sanitizeName(data.displayName);
  if (!name) throw new Error("Name is required");

  const pinHash = await hashPin(data.pin);
  const ageMode = deriveAgeMode(data.birthYear);

  await db.insert(schema.child).values({
    id,
    familyId,
    displayName: name,
    pinHash,
    birthYear: data.birthYear,
    ageMode,
    currentXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Create default subjects
  const defaultSubjects = [
    { name: "Math", color: "#ef4444", icon: "calculator", isRequired: true },
    { name: "Reading", color: "#3b82f6", icon: "book-open", isRequired: true },
    { name: "Science", color: "#22c55e", icon: "flask-conical", isRequired: false },
    { name: "History", color: "#f59e0b", icon: "landmark", isRequired: false },
    { name: "Art", color: "#a855f7", icon: "palette", isRequired: false },
  ];

  for (let i = 0; i < defaultSubjects.length; i++) {
    const s = defaultSubjects[i];
    await db.insert(schema.subject).values({
      id: nanoid(),
      childId: id,
      name: s.name,
      color: s.color,
      icon: s.icon,
      isDefault: true,
      isRequired: s.isRequired,
      isActive: true,
      sortOrder: i,
      createdAt: now,
    });
  }

  return { id, displayName: name };
}

export async function updateChild(childId: string, data: {
  displayName?: string;
  birthYear?: number;
}) {
  const familyId = await getFamilyIdForUser();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName) updates.displayName = sanitizeName(data.displayName);
  if (data.birthYear) {
    updates.birthYear = data.birthYear;
    updates.ageMode = deriveAgeMode(data.birthYear);
  }

  await db
    .update(schema.child)
    .set(updates)
    .where(and(eq(schema.child.id, childId), eq(schema.child.familyId, familyId)));
}

export async function deleteChild(childId: string) {
  const familyId = await getFamilyIdForUser();
  await db
    .delete(schema.child)
    .where(and(eq(schema.child.id, childId), eq(schema.child.familyId, familyId)));
}
