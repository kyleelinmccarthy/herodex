"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createResource, updateResource } from "@/lib/actions/quest-resources";

type ResourceData = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  details: string | null;
};

const RESOURCE_TYPES = [
  { value: "link", label: "Link" },
  { value: "textbook", label: "Textbook" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
] as const;

export function QuestResourceForm({
  questId,
  subjectId,
  resource,
  open,
  onClose,
}: {
  questId?: string;
  subjectId?: string;
  resource?: ResourceData;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = !!resource;

  const [type, setType] = useState(resource?.type ?? "link");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [details, setDetails] = useState(resource?.details ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEditing) {
        await updateResource(resource.id, {
          type: type as "link" | "textbook" | "video" | "document" | "other",
          title,
          url: url || undefined,
          details: details || undefined,
        });
      } else {
        await createResource({
          questId,
          subjectId,
          type: type as "link" | "textbook" | "video" | "document" | "other",
          title,
          url: url || undefined,
          details: details || undefined,
        });
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resource");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Resource" : "Add Resource"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="resource-type">Type</Label>
            <Select
              id="resource-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ST Math Chapter 5"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-url">URL (optional)</Label>
            <Input
              id="resource-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-details">Details (optional)</Label>
            <Input
              id="resource-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Pages 102-115, exercises 1-10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update" : "Add Resource"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
