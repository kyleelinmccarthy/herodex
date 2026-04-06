import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuestTimer, formatElapsed } from "./use-quest-timer";

const STORAGE_KEY = "kingdomsandcrowns:quest-timer";
const STOPPED_STORAGE_KEY = "kingdomsandcrowns:quest-timer:stopped";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useQuestTimer", () => {
  it("starts with no active timer", () => {
    const { result } = renderHook(() => useQuestTimer());
    expect(result.current.activeTimer).toBeNull();
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it("starts a timer and persists to localStorage", () => {
    const { result } = renderHook(() => useQuestTimer());
    act(() => result.current.startTimer("qa1"));
    expect(result.current.activeTimer?.assignmentId).toBe("qa1");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.assignmentId).toBe("qa1");
  });

  it("stops timer and persists stopped result", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));

    // Advance 5 minutes
    vi.setSystemTime(now + 5 * 60 * 1000);
    act(() => result.current.stopTimer());

    expect(result.current.activeTimer).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.stoppedResult).not.toBeNull();
    expect(result.current.stoppedResult!.durationMinutes).toBe(5);
    expect(result.current.stoppedResult!.assignmentId).toBe("qa1");
    // Persisted to localStorage
    const stored = JSON.parse(localStorage.getItem(STOPPED_STORAGE_KEY)!);
    expect(stored.durationMinutes).toBe(5);
  });

  it("cancels timer without creating stopped result", () => {
    const { result } = renderHook(() => useQuestTimer());
    act(() => result.current.startTimer("qa1"));
    act(() => result.current.cancelTimer());
    expect(result.current.activeTimer).toBeNull();
    expect(result.current.stoppedResult).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STOPPED_STORAGE_KEY)).toBeNull();
  });

  it("replaces existing timer when starting a new one", () => {
    const { result } = renderHook(() => useQuestTimer());
    act(() => result.current.startTimer("qa1"));
    act(() => result.current.startTimer("qa2"));
    expect(result.current.activeTimer?.assignmentId).toBe("qa2");
  });

  it("rehydrates from localStorage on mount", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const startedAt = now - 120_000; // 2 minutes ago
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ assignmentId: "qa1", startedAt }));

    const { result } = renderHook(() => useQuestTimer());
    expect(result.current.activeTimer?.assignmentId).toBe("qa1");
    // After the useEffect runs, elapsed should be computed
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(120);
  });

  it("pauses and resumes the timer", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));
    expect(result.current.isPaused).toBe(false);

    // Run for 2 minutes then pause
    vi.setSystemTime(now + 2 * 60 * 1000);
    act(() => result.current.pauseTimer());
    expect(result.current.isPaused).toBe(true);
    expect(result.current.elapsedSeconds).toBe(120);

    // Advance 5 minutes while paused — elapsed should not change
    vi.setSystemTime(now + 7 * 60 * 1000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedSeconds).toBe(120);

    // Resume and run for 1 more minute
    act(() => result.current.resumeTimer());
    expect(result.current.isPaused).toBe(false);
    vi.setSystemTime(now + 8 * 60 * 1000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedSeconds).toBe(180); // 2min + 1min = 3min
  });

  it("stop records correct duration after pause/resume", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));

    // Run 3 min, pause, wait 10 min, resume, run 2 min, stop
    vi.setSystemTime(now + 3 * 60 * 1000);
    act(() => result.current.pauseTimer());

    vi.setSystemTime(now + 13 * 60 * 1000);
    act(() => result.current.resumeTimer());

    vi.setSystemTime(now + 15 * 60 * 1000);
    act(() => result.current.stopTimer());
    // Should be 5 minutes (3 + 2), not 15
    expect(result.current.stoppedResult!.durationMinutes).toBe(5);
  });

  it("persists paused state to localStorage", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));

    vi.setSystemTime(now + 60_000);
    act(() => result.current.pauseTimer());

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.pausedAt).toBeDefined();
    expect(stored.accumulatedMs).toBe(60_000);
  });

  it("rehydrates paused timer from localStorage", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        assignmentId: "qa1",
        startedAt: now - 300_000,
        accumulatedMs: 120_000, // 2 min of actual work
        resumedAt: now - 120_000,
        pausedAt: now - 60_000, // paused 1 min ago
      })
    );

    const { result } = renderHook(() => useQuestTimer());
    expect(result.current.isPaused).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // Should show 2 minutes (accumulatedMs only, since paused)
    expect(result.current.elapsedSeconds).toBe(120);
  });

  it("returns minimum 1 minute for very short timers", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));

    // Stop after 10 seconds
    vi.setSystemTime(now + 10_000);
    act(() => result.current.stopTimer());
    expect(result.current.stoppedResult!.durationMinutes).toBe(1);
  });

  it("clearStoppedResult removes stopped result from all storage", () => {
    const { result } = renderHook(() => useQuestTimer());
    const now = Date.now();
    vi.setSystemTime(now);
    act(() => result.current.startTimer("qa1"));
    vi.setSystemTime(now + 60_000);
    act(() => result.current.stopTimer());
    expect(result.current.stoppedResult).not.toBeNull();

    act(() => result.current.clearStoppedResult());
    expect(result.current.stoppedResult).toBeNull();
    expect(localStorage.getItem(STOPPED_STORAGE_KEY)).toBeNull();
  });

  it("rehydrates stopped result from localStorage on mount", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    localStorage.setItem(
      STOPPED_STORAGE_KEY,
      JSON.stringify({
        assignmentId: "qa1",
        startedAt: now - 300_000,
        endedAt: now - 60_000,
        durationMinutes: 4,
      })
    );

    const { result } = renderHook(() => useQuestTimer());
    expect(result.current.stoppedResult).not.toBeNull();
    expect(result.current.stoppedResult!.assignmentId).toBe("qa1");
    expect(result.current.stoppedResult!.durationMinutes).toBe(4);
  });
});

describe("formatElapsed", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(599)).toBe("09:59");
  });

  it("formats hours as H:MM:SS", () => {
    expect(formatElapsed(3661)).toBe("1:01:01");
    expect(formatElapsed(7200)).toBe("2:00:00");
  });
});
