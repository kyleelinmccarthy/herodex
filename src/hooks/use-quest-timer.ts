"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "kingdomsandcrowns:quest-timer";
const STOPPED_STORAGE_KEY = "kingdomsandcrowns:quest-timer:stopped";

type TimerState = {
  assignmentId: string;
  startedAt: number; // epoch ms — original wall-clock start, never changes
  accumulatedMs: number; // ms from completed running segments (before current one)
  resumedAt: number; // epoch ms — when the current running segment began
  pausedAt?: number; // epoch ms — if set, timer is paused
};

export type StoppedResultState = {
  assignmentId: string;
  startedAt: number; // epoch ms — serializable for localStorage
  endedAt: number;
  durationMinutes: number;
};

const MAX_TIMER_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function readStorage(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.assignmentId || !parsed.startedAt) return null;
    // Clear stale timers older than 24 hours
    if (Date.now() - parsed.startedAt > MAX_TIMER_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Migrate legacy timers that lack the new fields
    return {
      assignmentId: parsed.assignmentId,
      startedAt: parsed.startedAt,
      accumulatedMs: parsed.accumulatedMs ?? 0,
      resumedAt: parsed.resumedAt ?? parsed.startedAt,
      pausedAt: parsed.pausedAt,
    };
  } catch {
    return null;
  }
}

function readStoppedStorage(): StoppedResultState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STOPPED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoppedResultState;
    if (!parsed.assignmentId || !parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Module-level external stores, kept in sync with localStorage and shared
// across all hook instances (and, via the storage event, other tabs).
const timerListeners = new Set<() => void>();
const stoppedListeners = new Set<() => void>();

let cachedTimerRaw: string | null = null;
let cachedTimerSnapshot: TimerState | null = null;

function getTimerSnapshot(): TimerState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedTimerRaw) return cachedTimerSnapshot;
  cachedTimerRaw = raw;
  cachedTimerSnapshot = readStorage();
  return cachedTimerSnapshot;
}
function getServerTimerSnapshot(): TimerState | null {
  return null;
}
function subscribeTimer(callback: () => void) {
  timerListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    timerListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedStoppedRaw: string | null = null;
let cachedStoppedSnapshot: StoppedResultState | null = null;

function getStoppedSnapshot(): StoppedResultState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STOPPED_STORAGE_KEY);
  if (raw === cachedStoppedRaw) return cachedStoppedSnapshot;
  cachedStoppedRaw = raw;
  cachedStoppedSnapshot = readStoppedStorage();
  return cachedStoppedSnapshot;
}
function getServerStoppedSnapshot(): StoppedResultState | null {
  return null;
}
function subscribeStopped(callback: () => void) {
  stoppedListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    stoppedListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function writeStorage(state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  timerListeners.forEach((fn) => fn());
}

function writeStoppedStorage(state: StoppedResultState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(STOPPED_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STOPPED_STORAGE_KEY);
  }
  stoppedListeners.forEach((fn) => fn());
}

/**
 * Clear the stored timer if it doesn't belong to any of the given assignment IDs.
 * Call this once at the page level with the current pending assignment IDs.
 */
export function clearOrphanedTimer(validAssignmentIds: Set<string>) {
  const stored = readStorage();
  if (stored && !validAssignmentIds.has(stored.assignmentId)) {
    writeStorage(null);
  }
}

function computeElapsedMs(timer: TimerState): number {
  if (timer.pausedAt) {
    return timer.accumulatedMs;
  }
  return timer.accumulatedMs + (Date.now() - timer.resumedAt);
}

export function useQuestTimer() {
  const activeTimer = useSyncExternalStore(subscribeTimer, getTimerSnapshot, getServerTimerSnapshot);
  const stoppedResult = useSyncExternalStore(subscribeStopped, getStoppedSnapshot, getServerStoppedSnapshot);

  // Force a re-render once a second while a timer is running (not paused) so
  // the derived elapsed time keeps advancing.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeTimer || activeTimer.pausedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  const elapsedSeconds = activeTimer ? Math.floor(computeElapsedMs(activeTimer) / 1000) : 0;

  const startTimer = useCallback((assignmentId: string) => {
    const now = Date.now();
    writeStorage({ assignmentId, startedAt: now, accumulatedMs: 0, resumedAt: now });
  }, []);

  const stopTimer = useCallback(() => {
    if (!activeTimer) return;
    const endedAt = Date.now();
    const totalMs = computeElapsedMs(activeTimer);
    const durationMinutes = Math.max(1, Math.round(totalMs / 60000));
    const stopped: StoppedResultState = {
      assignmentId: activeTimer.assignmentId,
      startedAt: activeTimer.startedAt,
      endedAt,
      durationMinutes,
    };
    writeStorage(null);
    writeStoppedStorage(stopped);
  }, [activeTimer]);

  const clearStoppedResult = useCallback(() => {
    writeStoppedStorage(null);
  }, []);

  const pauseTimer = useCallback(() => {
    if (!activeTimer || activeTimer.pausedAt) return;
    const now = Date.now();
    writeStorage({
      ...activeTimer,
      accumulatedMs: activeTimer.accumulatedMs + (now - activeTimer.resumedAt),
      pausedAt: now,
    });
  }, [activeTimer]);

  const resumeTimer = useCallback(() => {
    if (!activeTimer || !activeTimer.pausedAt) return;
    const now = Date.now();
    writeStorage({
      ...activeTimer,
      resumedAt: now,
      pausedAt: undefined,
    });
  }, [activeTimer]);

  const cancelTimer = useCallback(() => {
    writeStorage(null);
    writeStoppedStorage(null);
  }, []);

  return {
    activeTimer,
    elapsedSeconds,
    isPaused: !!activeTimer?.pausedAt,
    stoppedResult,
    startTimer,
    stopTimer,
    cancelTimer,
    clearStoppedResult,
    pauseTimer,
    resumeTimer,
  };
}

export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}
