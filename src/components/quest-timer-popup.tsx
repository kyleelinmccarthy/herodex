"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useQuestTimer, formatElapsed } from "@/hooks/use-quest-timer";
import { completeAssignment } from "@/lib/actions/quest-assignments";

export function QuestTimerPopup() {
  const router = useRouter();
  const {
    activeTimer,
    elapsedSeconds,
    isPaused,
    stoppedResult,
    stopTimer,
    cancelTimer,
    clearStoppedResult,
    pauseTimer,
    resumeTimer,
  } = useQuestTimer();
  const [acting, setActing] = useState(false);

  // Nothing to show
  if (!activeTimer && !stoppedResult) return null;

  function handleStop() {
    if (!activeTimer) return;
    stopTimer();
  }

  function handleCancel() {
    cancelTimer();
  }

  async function handleComplete() {
    if (!stoppedResult) return;
    setActing(true);
    try {
      await completeAssignment(stoppedResult.assignmentId, {
        durationMinutes: stoppedResult.durationMinutes,
        startedAt: new Date(stoppedResult.startedAt),
        endedAt: new Date(stoppedResult.endedAt),
        source: "timer",
      });
      clearStoppedResult();
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  function handleDiscard() {
    clearStoppedResult();
    router.refresh();
  }

  // Stopped state — show result and ask to complete or discard
  if (stoppedResult) {
    return (
      <div className="fixed right-4 top-4 z-50 animate-in fade-in slide-in-from-right-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-[var(--gold-border)] bg-[linear-gradient(180deg,rgba(17,26,46,0.97)_0%,rgba(10,16,30,1)_100%)] px-6 py-4 shadow-[0_0_40px_-10px_rgba(201,168,76,0.2),0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--gold-bright)]">
            Timer Stopped
          </div>
          <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
            {formatElapsed(stoppedResult.durationMinutes * 60)}
          </div>
          <div className="text-sm text-muted-foreground">
            {stoppedResult.durationMinutes} minute{stoppedResult.durationMinutes !== 1 ? "s" : ""}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleComplete} disabled={acting}>
              {acting ? "Saving..." : "Complete Quest"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscard} disabled={acting}>
              Discard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Running / paused state — show live timer
  return (
    <div className="fixed right-4 top-4 z-50 animate-in fade-in slide-in-from-right-4">
      <div className={`flex flex-col items-center gap-2 rounded-xl border-2 ${isPaused ? "border-[var(--gold-border)]" : "border-primary/40"} bg-[linear-gradient(180deg,rgba(17,26,46,0.97)_0%,rgba(10,16,30,1)_100%)] px-6 py-4 shadow-[0_0_40px_-10px_rgba(59,130,246,0.2),0_8px_30px_rgba(0,0,0,0.5)]`}>
        <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ${isPaused ? "text-[var(--gold-bright)]" : "text-primary"}`}>
          {isPaused ? (
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--gold-bright)]" />
          ) : (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          )}
          {isPaused ? "Paused" : "Quest in Progress"}
        </div>
        <div className={`font-mono text-4xl font-bold tabular-nums ${isPaused ? "text-muted-foreground" : "text-foreground"}`}>
          {formatElapsed(elapsedSeconds)}
        </div>
        <div className="flex gap-2">
          {isPaused ? (
            <Button size="sm" onClick={resumeTimer}>
              Resume
            </Button>
          ) : (
            <Button size="sm" onClick={pauseTimer} className="bg-blue-500 text-white hover:bg-blue-600">
              Pause
            </Button>
          )}
          <Button size="sm" onClick={handleStop} className="bg-red-600 text-white hover:bg-red-700">
            Stop Timer
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
