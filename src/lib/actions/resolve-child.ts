"use server";

import { eq } from "drizzle-orm";
import { getDemoPersona, isChildPersona, getChildIdForPersona } from "@/lib/auth/session";
import { getChildren } from "@/lib/actions/children";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Resolves which child to display data for.
 * - Child persona: forces their own child record
 * - Parent persona: uses selectedChildId from query, falls back to first child
 *
 * Returns { child, allChildren, isChildView }
 */
export async function resolveActiveChild(selectedChildId?: string) {
  const isDemoMode = process.env.DEMO_MODE === "true";

  if (isDemoMode) {
    const persona = await getDemoPersona();
    if (isChildPersona(persona)) {
      const childId = getChildIdForPersona(persona)!;
      // Query child directly — child personas don't own a family,
      // so we can't go through getFamilyIdForUser().
      const rows = await db
        .select()
        .from(schema.child)
        .where(eq(schema.child.id, childId))
        .limit(1);
      const child = rows[0] ?? null;
      return { child, allChildren: child ? [child] : [], isChildView: true };
    }
  }

  // Parent view
  let allChildren;
  try {
    allChildren = await getChildren();
  } catch {
    // No family exists yet
    return { child: null, allChildren: [], isChildView: false };
  }
  if (allChildren.length === 0) {
    return { child: null, allChildren: [], isChildView: false };
  }

  const child = selectedChildId
    ? allChildren.find((c) => c.id === selectedChildId) ?? allChildren[0]
    : allChildren[0];

  return { child, allChildren, isChildView: false };
}
