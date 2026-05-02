"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ExtraDayBucket, ExtraDayBucketSummary, ExtraDayTarget } from "@/lib/types";
import { TargetCard } from "./target-card";

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface BucketCardProps {
  bucketSummary: ExtraDayBucketSummary;
  canAllocate: boolean;
  onEditBucket: (bucket: ExtraDayBucket) => void;
  onAddTarget: (bucketId: number) => void;
  onEditTarget: (target: ExtraDayTarget) => void;
  onAddAllocation: (bucketId?: number, targetId?: number) => void;
}

export function BucketCard({
  bucketSummary,
  canAllocate,
  onEditBucket,
  onAddTarget,
  onEditTarget,
  onAddAllocation,
}: BucketCardProps) {
  const { bucket, targets } = bucketSummary;

  return (
    <Card className={!bucket.isActive ? "border-dashed opacity-80" : undefined}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>{bucket.name}</CardTitle>
              {!bucket.isActive && <Badge variant="outline">Archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDays(bucketSummary.totalDays)} planner days assigned · {formatCurrency(bucketSummary.totalAmountInr)} converted
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => onEditBucket(bucket)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!bucket.isActive}
              onClick={() => onAddTarget(bucket.id)}
            >
              Add Target
            </Button>
            <Button
              size="sm"
              disabled={!canAllocate || !bucket.isActive}
              onClick={() => onAddAllocation(bucket.id)}
            >
              Allocate
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Day Reserve</p>
            <p className="mt-2 text-lg font-semibold">{formatDays(bucketSummary.reserveDayDays)} days</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Money Reserve</p>
            <p className="mt-2 text-lg font-semibold">{formatCurrency(bucketSummary.reserveMoneyAmountInr)}</p>
            <p className="text-xs text-muted-foreground">{formatDays(bucketSummary.reserveMoneyDays)} days converted</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Targets</p>
            <p className="mt-2 text-lg font-semibold">{targets.length}</p>
            <p className="text-xs text-muted-foreground">
              {targets.filter((target) => target.isReady).length} ready
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {targets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No targets yet. Use the bucket as a general reserve, or add specific day or money goals under it.
          </div>
        ) : (
          targets.map((targetSummary) => (
            <TargetCard
              key={targetSummary.target.id}
              summary={targetSummary}
              canAllocate={canAllocate}
              onEditTarget={onEditTarget}
              onAddAllocation={onAddAllocation}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
