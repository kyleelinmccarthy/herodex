"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createQuest, updateQuest } from "@/lib/actions/quests";
import { getQuestUnlockableItems, getCategoryLabel } from "@/lib/utils/avatar-catalog";

type Subject = { id: string; name: string; color: string | null };

type QuestData = {
  id: string;
  title: string;
  subjectId: string;
  description: string | null;
  estimatedMinutes: number | null;
  rewardXp: number | null;
  rewardDescription: string | null;
  rewardAvatarItem: string | null;
};

const ALL_AVATAR_REWARD_OPTIONS = getQuestUnlockableItems();

export function QuestTemplateForm({
  childId,
  subjects,
  quest,
  open,
  onClose,
  childUnlockedItems = [],
  assignedAvatarItems = [],
}: {
  childId: string;
  subjects: Subject[];
  quest?: QuestData;
  open: boolean;
  onClose: () => void;
  /** Item IDs the child has already unlocked via quest rewards */
  childUnlockedItems?: string[];
  /** Avatar reward JSON strings already assigned to other active quests */
  assignedAvatarItems?: string[];
}) {
  const router = useRouter();
  const isEditing = !!quest;

  const [title, setTitle] = useState(quest?.title ?? "");
  const [subjectId, setSubjectId] = useState(quest?.subjectId ?? subjects[0]?.id ?? "");
  const [description, setDescription] = useState(quest?.description ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    quest?.estimatedMinutes?.toString() ?? ""
  );
  const [rewardXp, setRewardXp] = useState(quest?.rewardXp?.toString() ?? "");
  const [rewardDescription, setRewardDescription] = useState(quest?.rewardDescription ?? "");
  const [rewardAvatarItem, setRewardAvatarItem] = useState(quest?.rewardAvatarItem ?? "");
  const [showRewards, setShowRewards] = useState(
    !!(quest?.rewardXp || quest?.rewardDescription || quest?.rewardAvatarItem)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const rewardFields = {
        rewardXp: rewardXp ? parseInt(rewardXp) : undefined,
        rewardDescription: rewardDescription || undefined,
        rewardAvatarItem: rewardAvatarItem || undefined,
      };

      if (isEditing) {
        await updateQuest(quest.id, {
          title,
          subjectId,
          description: description || undefined,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          rewardXp: rewardXp ? parseInt(rewardXp) : null,
          rewardDescription: rewardDescription || null,
          rewardAvatarItem: rewardAvatarItem || null,
        });
      } else {
        await createQuest({
          childId,
          subjectId,
          title,
          description: description || undefined,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
          ...rewardFields,
        });
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quest");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Quest" : "New Quest"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="quest-title">Quest Title</Label>
            <Input
              id="quest-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Read Chapter 5 of the Ancient Tome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-subject">Discipline</Label>
            <Select
              id="quest-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-duration">Estimated Duration (minutes)</Label>
            <Input
              id="quest-duration"
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="30"
              min={1}
              max={480}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quest-description">Description (optional)</Label>
            <Input
              id="quest-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Complete exercises 1-10, review vocabulary"
            />
          </div>

          {/* Quest Rewards Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowRewards(!showRewards)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showRewards ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Quest Rewards (optional)
            </button>

            {showRewards && (
              <div className="space-y-3 rounded-lg border border-dashed border-[var(--gold-dim)] bg-[rgba(201,168,76,0.04)] p-3">
                <div className="space-y-2">
                  <Label htmlFor="reward-xp">Bonus XP Reward</Label>
                  <Input
                    id="reward-xp"
                    type="number"
                    value={rewardXp}
                    onChange={(e) => setRewardXp(e.target.value)}
                    placeholder="e.g. 25"
                    min={5}
                    max={100}
                  />
                  <p className="text-[10px] text-muted-foreground">Extra XP on top of the standard 10 XP per quest</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-description">Custom Reward</Label>
                  <Input
                    id="reward-description"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    placeholder="e.g. 30 min screen time, pick dinner tonight"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reward-avatar">Avatar Item Unlock</Label>
                  <Select
                    id="reward-avatar"
                    value={rewardAvatarItem}
                    onChange={(e) => setRewardAvatarItem(e.target.value)}
                  >
                    <option value="">No avatar reward</option>
                    {ALL_AVATAR_REWARD_OPTIONS.map(({ category, item }) => {
                      const jsonVal = JSON.stringify({ category, itemId: item.id });
                      const alreadyUnlocked = childUnlockedItems.includes(item.id);
                      const alreadyAssigned = assignedAvatarItems.some((a) => {
                        try {
                          const parsed = JSON.parse(a) as { itemId: string };
                          return parsed.itemId === item.id;
                        } catch { return false; }
                      });
                      // Allow re-selecting the item that's already on THIS quest
                      const isCurrentQuest = rewardAvatarItem === jsonVal || quest?.rewardAvatarItem === jsonVal;
                      const disabled = alreadyUnlocked || (alreadyAssigned && !isCurrentQuest);
                      const suffix = alreadyUnlocked
                        ? " (already unlocked)"
                        : alreadyAssigned && !isCurrentQuest
                          ? " (assigned to another quest)"
                          : "";
                      return (
                        <option
                          key={`${category}-${item.id}`}
                          value={jsonVal}
                          disabled={disabled}
                        >
                          {getCategoryLabel(category)}: {item.label}{suffix}
                        </option>
                      );
                    })}
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Unlock a special avatar item when this quest is completed</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update Quest" : "Create Quest"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
