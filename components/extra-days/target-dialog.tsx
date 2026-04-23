"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveExtraDayTarget, createExtraDayTarget, updateExtraDayTarget } from "@/actions/extra-days";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExtraDayBucket, ExtraDayTarget } from "@/lib/types";

interface TargetDialogProps {
  open: boolean;
  onClose: () => void;
  target: ExtraDayTarget | null;
  buckets: ExtraDayBucket[];
  defaultBucketId: number | null;
}

export function TargetDialog({ open, onClose, target, buckets, defaultBucketId }: TargetDialogProps) {
  const router = useRouter();
  const [bucketId, setBucketId] = useState("");
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<"day" | "money">("day");
  const [goalDays, setGoalDays] = useState("");
  const [goalAmountInr, setGoalAmountInr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBucketId(String(target?.bucketId ?? defaultBucketId ?? buckets.find((bucket) => bucket.isActive)?.id ?? ""));
    setName(target?.name ?? "");
    setTargetType(target?.targetType ?? "day");
    setGoalDays(target?.goalDays != null ? String(target.goalDays) : "");
    setGoalAmountInr(target?.goalAmountInr != null ? String(target.goalAmountInr) : "");
    setNotes(target?.notes ?? "");
  }, [target, open, defaultBucketId, buckets]);

  const activeBuckets = buckets.filter((bucket) => bucket.isActive || bucket.id === target?.bucketId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      bucketId: Number(bucketId),
      name,
      targetType,
      goalDays: targetType === "day" ? parseFloat(goalDays) : null,
      goalAmountInr: targetType === "money" ? parseFloat(goalAmountInr) : null,
      notes,
    } as const;

    const result = target
      ? await updateExtraDayTarget(target.id, payload)
      : await createExtraDayTarget(payload);

    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save target");
      return;
    }

    toast.success(target ? "Target updated" : "Target created");
    router.refresh();
    onClose();
  }

  async function handleArchive() {
    if (!target) return;
    if (!window.confirm(`Archive target "${target.name}"?`)) return;

    const result = await archiveExtraDayTarget(target.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to archive target");
      return;
    }

    toast.success("Target archived");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target ? "Edit Target" : "Create Target"}</DialogTitle>
          <DialogDescription>
            Choose whether this target fills by days or by money. Trips should use days; gear or purchases should use money.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Bucket</Label>
            <Select value={bucketId} onValueChange={setBucketId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bucket" />
              </SelectTrigger>
              <SelectContent>
                {activeBuckets.map((bucketOption) => (
                  <SelectItem key={bucketOption.id} value={String(bucketOption.id)}>
                    {bucketOption.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-name">Target name</Label>
            <Input
              id="target-name"
              placeholder="Goa Trip, Kayak, Roof Rack"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Target type</Label>
            <Select value={targetType} onValueChange={(value: "day" | "money") => setTargetType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Days</SelectItem>
                <SelectItem value="money">Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType === "day" ? (
            <div className="space-y-2">
              <Label htmlFor="goal-days">Goal days</Label>
              <Input
                id="goal-days"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="4"
                value={goalDays}
                onChange={(event) => setGoalDays(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="goal-amount">Goal amount (INR)</Label>
              <Input
                id="goal-amount"
                type="number"
                min="1"
                step="1"
                placeholder="25000"
                value={goalAmountInr}
                onChange={(event) => setGoalAmountInr(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="target-notes">Notes</Label>
            <Textarea
              id="target-notes"
              placeholder="Optional context for this target"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              {target?.status === "active" && (
                <Button type="button" variant="outline" onClick={handleArchive}>
                  Archive
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : target ? "Save Changes" : "Create Target"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
