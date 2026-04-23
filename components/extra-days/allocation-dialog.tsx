"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createExtraDayAllocation, updateExtraDayAllocation } from "@/actions/extra-days";
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
import { formatCurrency } from "@/lib/utils";
import type { ExtraDayAllocationDetail, ExtraDayBucketSummary } from "@/lib/types";

const RESERVE_VALUE = "__reserve__";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AllocationDialogProps {
  open: boolean;
  onClose: () => void;
  allocation: ExtraDayAllocationDetail | null;
  financialYear: string;
  buckets: ExtraDayBucketSummary[];
  allocations: ExtraDayAllocationDetail[];
  defaultBucketId: number | null;
  defaultTargetId: number | null;
  canAllocate: boolean;
}

export function AllocationDialog({
  open,
  onClose,
  allocation,
  financialYear,
  buckets,
  allocations,
  defaultBucketId,
  defaultTargetId,
  canAllocate,
}: AllocationDialogProps) {
  const router = useRouter();
  const [bucketId, setBucketId] = useState("");
  const [targetValue, setTargetValue] = useState(RESERVE_VALUE);
  const [kind, setKind] = useState<"day" | "money">("day");
  const [days, setDays] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [confirmedDate, setConfirmedDate] = useState(todayString());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const activeBuckets = buckets.filter((bucket) => bucket.bucket.isActive || bucket.bucket.id === allocation?.bucketId);
  const selectedBucket = activeBuckets.find((bucket) => String(bucket.bucket.id) === bucketId);
  const selectableTargets = (selectedBucket?.targets ?? []).filter(
    (targetSummary) => targetSummary.target.status === "active" || targetSummary.target.id === allocation?.targetId,
  );
  const selectedTarget = selectableTargets.find((targetSummary) => String(targetSummary.target.id) === targetValue)?.target ?? null;
  const effectiveKind = selectedTarget ? selectedTarget.targetType : kind;
  const computedAmount = effectiveKind === "money" && days && dailyRate
    ? Number(days) * Number(dailyRate)
    : 0;

  useEffect(() => {
    const fallbackBucketId = allocation?.bucketId
      ?? defaultBucketId
      ?? activeBuckets[0]?.bucket.id
      ?? null;
    const lastRate = fallbackBucketId != null
      ? allocations.find((row) => row.bucketId === fallbackBucketId && row.kind === "money")?.dailyRate
      : null;

    setBucketId(fallbackBucketId != null ? String(fallbackBucketId) : "");
    setTargetValue(allocation?.targetId != null
      ? String(allocation.targetId)
      : defaultTargetId != null
        ? String(defaultTargetId)
        : RESERVE_VALUE);
    setKind(allocation?.kind ?? (defaultTargetId != null ? "day" : "day"));
    setDays(allocation ? String(allocation.days) : "");
    setDailyRate(allocation?.dailyRate != null ? String(allocation.dailyRate) : lastRate != null ? String(lastRate) : "");
    setConfirmedDate(allocation?.confirmedDate ?? todayString());
    setNotes(allocation?.notes ?? "");
  }, [allocation, open, defaultBucketId, defaultTargetId, activeBuckets, allocations]);

  useEffect(() => {
    if (!selectedTarget) return;
    setKind(selectedTarget.targetType);
    if (selectedTarget.targetType === "day") {
      setDailyRate("");
    }
  }, [selectedTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allocation && !canAllocate) {
      toast.error("The planner cannot accept new allocations right now.");
      return;
    }

    setSaving(true);
    const payload = {
      bucketId: Number(bucketId),
      targetId: targetValue === RESERVE_VALUE ? null : Number(targetValue),
      financialYear,
      kind: effectiveKind,
      confirmedDate,
      days: parseFloat(days),
      dailyRate: effectiveKind === "money" ? parseFloat(dailyRate) : null,
      notes,
    } as const;

    const result = allocation
      ? await updateExtraDayAllocation(allocation.id, payload)
      : await createExtraDayAllocation(payload);

    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save allocation");
      return;
    }

    toast.success(allocation ? "Allocation updated" : "Allocation created");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{allocation ? "Edit Allocation" : "Create Allocation"}</DialogTitle>
          <DialogDescription>
            Allocations live only inside this planner. They consume planner days, but they never create expense entries or calendar rows.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Bucket</Label>
            <Select value={bucketId} onValueChange={(value) => { setBucketId(value); setTargetValue(RESERVE_VALUE); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select bucket" />
              </SelectTrigger>
              <SelectContent>
                {activeBuckets.map((bucketSummary) => (
                  <SelectItem key={bucketSummary.bucket.id} value={String(bucketSummary.bucket.id)}>
                    {bucketSummary.bucket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Destination</Label>
            <Select value={targetValue} onValueChange={setTargetValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RESERVE_VALUE}>General Reserve</SelectItem>
                {selectableTargets.map((targetSummary) => (
                  <SelectItem key={targetSummary.target.id} value={String(targetSummary.target.id)}>
                    {targetSummary.target.name} ({targetSummary.target.targetType === "money" ? "Money" : "Days"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedTarget && (
            <div className="space-y-2">
              <Label>Allocation type</Label>
              <Select value={kind} onValueChange={(value: "day" | "money") => setKind(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Days</SelectItem>
                  <SelectItem value="money">Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedTarget && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              This target accepts <span className="font-medium text-foreground">{selectedTarget.targetType === "money" ? "money" : "day"}</span> allocations only.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="allocation-days">Days</Label>
              <Input
                id="allocation-days"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="1.5"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allocation-date">Confirmed date</Label>
              <Input
                id="allocation-date"
                type="date"
                value={confirmedDate}
                onChange={(event) => setConfirmedDate(event.target.value)}
              />
            </div>
          </div>

          {effectiveKind === "money" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="allocation-rate">Daily rate (INR)</Label>
                <Input
                  id="allocation-rate"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="5000"
                  value={dailyRate}
                  onChange={(event) => setDailyRate(event.target.value)}
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2 text-sm">
                Amount: <span className="font-semibold">{formatCurrency(Number.isFinite(computedAmount) ? computedAmount : 0)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="allocation-notes">Notes</Label>
            <Textarea
              id="allocation-notes"
              placeholder="Optional note for this allocation"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !bucketId || !days || (effectiveKind === "money" && !dailyRate)}
            >
              {saving ? "Saving..." : allocation ? "Save Changes" : "Create Allocation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
