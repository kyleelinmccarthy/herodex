"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeroLogin } from "@/components/hero-login";
import { GameIcon } from "@/components/game-icon";

export function ViewAsHeroButton({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <GameIcon name="swords" className="size-3" />
        View as {childName} →
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>Play as {childName}</DialogTitle>
        </DialogHeader>
        <HeroLogin mode="handoff" preselectChildId={childId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
