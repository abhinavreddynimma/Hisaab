"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveExtraDayTarget, markExtraDayTargetCompleted } from "@/actions/extra-days";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ExtraDayTarget, ExtraDayTargetSummary } from "@/lib/types";

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function progressTone(summary: ExtraDayTargetSummary): string {
  if (summary.target.status === "archived") return "bg-slate-400";
  if (summary.target.status === "completed") return "bg-emerald-600";
  if (summary.isReady) return "bg-emerald-500";
  return summary.target.targetType === "money" ? "bg-amber-500" : "bg-sky-500";
}

function statusVariant(summary: ExtraDayTargetSummary): "default" | "secondary" | "destructive" | "outline" {
  if (summary.target.status === "archived") return "outline";
  if (summary.target.status === "completed") return "secondary";
  if (summary.isReady) return "default";
  return "outline";
}

interface TargetCardProps {
  summary: ExtraDayTargetSummary;
  canAllocate: boolean;
  onEditTarget: (target: ExtraDayTarget) => void;
  onAddAllocation: (bucketId?: number, targetId?: number) => void;
}

export function TargetCard({ summary, canAllocate, onEditTarget, onAddAllocation }: TargetCardProps) {
  const router = useRouter();

  async function handleArchive() {
    if (!window.confirm(`Archive target "${summary.target.name}"?`)) return;
    const result = await archiveExtraDayTarget(summary.target.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to archive target");
      return;
    }
    toast.success("Target archived");
    router.refresh();
  }

  async function handleComplete() {
    const label = summary.target.targetType === "money" ? "mark as purchased" : "mark as completed";
    if (!window.confirm(`Do you want to ${label} for "${summary.target.name}"?`)) return;
    const result = await markExtraDayTargetCompleted(summary.target.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to update target");
      return;
    }
    toast.success(summary.target.targetType === "money" ? "Target marked as purchased" : "Target marked as completed");
    router.refresh();
  }

  const goalLabel = summary.target.targetType === "money"
    ? formatCurrency(summary.target.goalAmountInr ?? 0)
    : `${formatDays(summary.target.goalDays ?? 0)} days`;
  const progressLabel = summary.target.targetType === "money"
    ? formatCurrency(summary.fundedAmountInr)
    : `${formatDays(summary.fundedDays)} days`;
  const remainingLabel = summary.target.targetType === "money"
    ? formatCurrency(summary.remainingAmountInr)
    : `${formatDays(summary.remainingDays)} days`;

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{summary.target.name}</p>
              <Badge variant="outline">{summary.target.targetType === "money" ? "Money" : "Days"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Goal: {goalLabel}
            </p>
          </div>
          <Badge variant={statusVariant(summary)}>{summary.readinessLabel}</Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>{progressLabel}</span>
            <span className="text-muted-foreground">
              {Math.round(summary.fundedPct * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all ${progressTone(summary)}`}
              style={{ width: `${Math.min(summary.fundedPct * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Remaining: {remainingLabel}
            </span>
            {summary.target.targetType === "money" && (
              <span>{formatDays(summary.fundedDays)} days assigned</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!canAllocate || summary.target.status !== "active"}
            onClick={() => onAddAllocation(summary.target.bucketId, summary.target.id)}
          >
            Allocate
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEditTarget(summary.target)}>
            Edit
          </Button>
          {summary.isReady && summary.target.status === "active" && (
            <Button size="sm" variant="outline" onClick={handleComplete}>
              {summary.target.targetType === "money" ? "Mark Purchased" : "Mark Completed"}
            </Button>
          )}
          {summary.target.status === "active" && (
            <Button size="sm" variant="outline" onClick={handleArchive}>
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
