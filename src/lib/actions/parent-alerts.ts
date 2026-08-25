"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireFamilyAccess, accessibleChildIds } from "@/lib/auth/access";

const MAX_ALERTS = 50;

export type ParentAlert = {
  id: string;
  type: string;
  childId: string;
  childName: string;
  questTitle: string;
  subjectName: string | null;
  date: string;
  note: string | null;
  createdAt: string;
};

/**
 * Alerts this guardian has not cleared yet, newest first. Dismissals are
 * per-guardian (a left join against their own rows), so one parent clearing
 * an alert never takes it off another's dashboard. requireFamilyAccess turns
 * children away outright, and the scope filter keeps a guardian granted only
 * some heroes from seeing the others' alerts.
 */
export async function getParentAlerts(): Promise<ParentAlert[]> {
  const access = await requireFamilyAccess();
  const childIds = await accessibleChildIds(access);
  if (childIds.length === 0) return [];

  const rows = await db
    .select({ alert: schema.parentAlert })
    .from(schema.parentAlert)
    .leftJoin(
      schema.parentAlertDismissal,
      and(
        eq(schema.parentAlertDismissal.alertId, schema.parentAlert.id),
        eq(schema.parentAlertDismissal.userId, access.userId)
      )
    )
    .where(
      and(
        eq(schema.parentAlert.familyId, access.familyId),
        inArray(schema.parentAlert.childId, childIds),
        isNull(schema.parentAlertDismissal.id)
      )
    )
    .orderBy(desc(schema.parentAlert.createdAt))
    .limit(MAX_ALERTS);

  return rows.map(({ alert }) => ({
    id: alert.id,
    type: alert.type,
    childId: alert.childId,
    childName: alert.childName,
    questTitle: alert.questTitle,
    subjectName: alert.subjectName,
    date: alert.date,
    note: alert.note,
    createdAt: alert.createdAt.toISOString(),
  }));
}

/** Clears one alert for the guardian doing the clearing; other guardians keep theirs. */
export async function dismissParentAlert(alertId: string) {
  const access = await requireFamilyAccess({ write: true });
  const childIds = await accessibleChildIds(access);
  if (childIds.length === 0) return;

  // Confirm the alert is one this guardian can actually see before recording a
  // dismissal against it — the id arrives from the client.
  const rows = await db
    .select({ id: schema.parentAlert.id })
    .from(schema.parentAlert)
    .where(
      and(
        eq(schema.parentAlert.id, alertId),
        eq(schema.parentAlert.familyId, access.familyId),
        inArray(schema.parentAlert.childId, childIds)
      )
    )
    .limit(1);
  if (!rows[0]) return;

  await recordDismissals([alertId], access.userId);
}

/**
 * Clears everything currently on this guardian's list, and only theirs. Bounded
 * by the same MAX_ALERTS window the list itself shows, so anything older than
 * that stays until it scrolls into view and is cleared in turn.
 */
export async function dismissAllParentAlerts() {
  const access = await requireFamilyAccess({ write: true });
  const alerts = await getParentAlerts();
  if (alerts.length === 0) return;
  await recordDismissals(
    alerts.map((a) => a.id),
    access.userId
  );
}

/** onConflictDoNothing so a double-click (or two open tabs) can't collide on the unique index. */
async function recordDismissals(alertIds: string[], userId: string) {
  const now = new Date();
  await db
    .insert(schema.parentAlertDismissal)
    .values(
      alertIds.map((alertId) => ({
        id: nanoid(),
        alertId,
        userId,
        dismissedAt: now,
      }))
    )
    .onConflictDoNothing();
}
