"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import type { AvatarConfig } from "@/lib/utils/avatar-catalog";

type Child = {
  id: string;
  displayName: string;
  ageMode: string;
  avatarConfig: string | null;
};

export function ChildSelector({
  children,
  selectedId,
}: {
  children: Child[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(childId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", childId);
    router.push(`?${params.toString()}`);
  }

  if (children.length === 0) return null;

  return (
    <div className="flex gap-2">
      {children.map((child) => (
        <button
          key={child.id}
          onClick={() => select(child.id)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-brand text-lg tracking-wide transition-colors",
            selectedId === child.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Avatar
            config={child.avatarConfig ? JSON.parse(child.avatarConfig) as AvatarConfig : null}
            name={child.displayName}
            size="xs"
          />
          {child.displayName}
        </button>
      ))}
    </div>
  );
}
