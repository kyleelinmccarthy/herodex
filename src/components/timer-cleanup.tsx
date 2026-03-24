"use client";

import { useEffect } from "react";
import { clearOrphanedTimer } from "@/hooks/use-quest-timer";

/**
 * Clears any stored quest timer that doesn't match a current pending assignment.
 * Render this once per page that shows QuestAssignmentCards.
 */
export function TimerCleanup({ pendingAssignmentIds }: { pendingAssignmentIds: string[] }) {
  useEffect(() => {
    clearOrphanedTimer(new Set(pendingAssignmentIds));
  }, [pendingAssignmentIds]);
  return null;
}
