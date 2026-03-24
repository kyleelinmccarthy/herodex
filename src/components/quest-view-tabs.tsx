"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "today", label: "Today", icon: "⚔️" },
  { value: "adventure", label: "Complete Adventure", icon: "🏕️" },
] as const;

export function QuestViewTabs({ active }: { active: "today" | "adventure" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "today") {
      params.delete("view");
    } else {
      params.set("view", tab);
    }
    const qs = params.toString();
    router.push(`/quests${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => switchTab(tab.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            active === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span role="img" aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
