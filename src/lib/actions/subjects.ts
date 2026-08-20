"use server";

import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sanitizeName } from "@/lib/utils/sanitize";
import { requireChildAccess, requireSubjectAccess } from "@/lib/auth/access";

export async function getSubjects(childId: string) {
  await requireChildAccess(childId);
  return db
    .select()
    .from(schema.subject)
    .where(and(eq(schema.subject.childId, childId), eq(schema.subject.isActive, true)))
    .orderBy(schema.subject.sortOrder);
}

export async function createSubject(childId: string, data: {
  name: string;
  color?: string;
  icon?: string;
}) {
  await requireChildAccess(childId, { write: true });
  const id = nanoid();
  const name = sanitizeName(data.name);
  if (!name) throw new Error("Subject name is required");

  // Get max sort order
  const existing = await db
    .select({ sortOrder: schema.subject.sortOrder })
    .from(schema.subject)
    .where(eq(schema.subject.childId, childId));
  const maxSort = existing.reduce((max, s) => Math.max(max, s.sortOrder), -1);

  await db.insert(schema.subject).values({
    id,
    childId,
    name,
    color: data.color ?? "#6b7280",
    icon: data.icon ?? "book",
    isDefault: false,
    isRequired: false,
    isActive: true,
    sortOrder: maxSort + 1,
    createdAt: new Date(),
  });

  return { id, name };
}

export async function updateSubject(subjectId: string, data: {
  name?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}) {
  await requireSubjectAccess(subjectId, { write: true });
  const updates: Record<string, unknown> = {};
  if (data.name) updates.name = sanitizeName(data.name);
  if (data.color) updates.color = data.color;
  if (data.icon) updates.icon = data.icon;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  await db
    .update(schema.subject)
    .set(updates)
    .where(eq(schema.subject.id, subjectId));
}

export async function reorderSubjects(childId: string, orderedSubjectIds: string[]) {
  await requireChildAccess(childId, { write: true });

  const existing = await db
    .select({ id: schema.subject.id })
    .from(schema.subject)
    .where(and(eq(schema.subject.childId, childId), eq(schema.subject.isActive, true)));
  const existingIds = new Set(existing.map((s) => s.id));

  if (
    orderedSubjectIds.length !== existingIds.size ||
    !orderedSubjectIds.every((id) => existingIds.has(id))
  ) {
    throw new Error("Subject list is out of date — refresh and try again.");
  }

  await Promise.all(
    orderedSubjectIds.map((id, index) =>
      db
        .update(schema.subject)
        .set({ sortOrder: index })
        .where(and(eq(schema.subject.id, id), eq(schema.subject.childId, childId)))
    )
  );
}

export async function deleteSubject(subjectId: string) {
  await requireSubjectAccess(subjectId, { write: true });
  // Soft delete — deactivate
  await db
    .update(schema.subject)
    .set({ isActive: false })
    .where(eq(schema.subject.id, subjectId));
}
