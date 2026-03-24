"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "herodex:quest-timer";
const STOPPED_STORAGE_KEY = "herodex:quest-timer:stopped";

// Module-level listener sets so all hook instances stay in sync
type TimerListener = (state: TimerState | null) => void;
type StoppedListener = (state: StoppedResultState | null) => void;
const timerListeners = new Set<TimerListener>();
const stoppedListeners = new Set<StoppedListener>();

function notifyTimerListeners(state: TimerState | null) {
  timerListeners.forEach((fn) => fn(state));
}
function notifyStoppedListeners(state: StoppedResultState | null) {
  stoppedListeners.forEach((fn) => fn(state));
}

type TimerState = {
  assignmentId: string;
  startedAt: number; // epoch ms — original wall-clock start, never changes
  accumulatedMs: number; // ms from completed running segments (before current one)
  resumedAt: number; // epoch ms — when the current running segment began
  pausedAt?: number; // epoch ms — if set, timer is paused
};

type StopResult = {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
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

function writeStorage(state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  notifyTimerListeners(state);
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

function writeStoppedStorage(state: StoppedResultState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(STOPPED_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STOPPED_STORAGE_KEY);
  }
  notifyStoppedListeners(state);
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

export function useQuestTimer() {
  const [activeTimer, setActiveTimer] = useState<TimerState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stoppedResult, setStoppedResult] = useState<StoppedResultState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compute elapsed ms from timer state
  const computeElapsedMs = useCallback((timer: TimerState) => {
    if (timer.pausedAt) {
      return timer.accumulatedMs;
    }
    return timer.accumulatedMs + (Date.now() - timer.resumedAt);
  }, []);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      setActiveTimer(stored);
      setElapsedSeconds(Math.floor(computeElapsedMs(stored) / 1000));
    }
    const stopped = readStoppedStorage();
    if (stopped) {
      setStoppedResult(stopped);
    }
  }, [computeElapsedMs]);

  // Subscribe to timer changes from other hook instances in the same tab
  useEffect(() => {
    const handler: TimerListener = (state) => {
      setActiveTimer(state);
      if (state) {
        setElapsedSeconds(Math.floor(computeElapsedMs(state) / 1000));
      } else {
        setElapsedSeconds(0);
      }
    };
    timerListeners.add(handler);
    return () => { timerListeners.delete(handler); };
  }, [computeElapsedMs]);

  // Subscribe to stopped result changes from other hook instances in the same tab
  useEffect(() => {
    const handler: StoppedListener = (state) => {
      setStoppedResult(state);
    };
    stoppedListeners.add(handler);
    return () => { stoppedListeners.delete(handler); };
  }, []);

  // Sync across browser tabs via the storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const state = readStorage();
        setActiveTimer(state);
        if (state) {
          setElapsedSeconds(Math.floor(computeElapsedMs(state) / 1000));
        } else {
          setElapsedSeconds(0);
        }
      }
      if (e.key === STOPPED_STORAGE_KEY) {
        setStoppedResult(readStoppedStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [computeElapsedMs]);

  // Tick elapsed time while a timer is active and not paused
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeTimer) {
      if (activeTimer.pausedAt) {
        // Paused — set elapsed once, no interval
        setElapsedSeconds(Math.floor(activeTimer.accumulatedMs / 1000));
      } else {
        intervalRef.current = setInterval(() => {
          setElapsedSeconds(Math.floor(computeElapsedMs(activeTimer) / 1000));
        }, 1000);
      }
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeTimer, computeElapsedMs]);

  const startTimer = useCallback((assignmentId: string) => {
    const now = Date.now();
    const state: TimerState = { assignmentId, startedAt: now, accumulatedMs: 0, resumedAt: now };
    writeStorage(state);
    setActiveTimer(state);
    setElapsedSeconds(0);
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
    setActiveTimer(null);
    writeStoppedStorage(stopped);
    setStoppedResult(stopped);
  }, [activeTimer, computeElapsedMs]);

  const clearStoppedResult = useCallback(() => {
    writeStoppedStorage(null);
    setStoppedResult(null);
  }, []);

  const pauseTimer = useCallback(() => {
    if (!activeTimer || activeTimer.pausedAt) return;
    const now = Date.now();
    const state: TimerState = {
      ...activeTimer,
      accumulatedMs: activeTimer.accumulatedMs + (now - activeTimer.resumedAt),
      pausedAt: now,
    };
    writeStorage(state);
    setActiveTimer(state);
  }, [activeTimer]);

  const resumeTimer = useCallback(() => {
    if (!activeTimer || !activeTimer.pausedAt) return;
    const now = Date.now();
    const state: TimerState = {
      ...activeTimer,
      resumedAt: now,
      pausedAt: undefined,
    };
    writeStorage(state);
    setActiveTimer(state);
  }, [activeTimer]);

  const cancelTimer = useCallback(() => {
    writeStorage(null);
    setActiveTimer(null);
    writeStoppedStorage(null);
    setStoppedResult(null);
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
