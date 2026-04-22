"use client";

import { useState } from "react";
import type { ExtraDayAllocationDetail, ExtraDayBucket, ExtraDaysPlannerData, ExtraDayTarget } from "@/lib/types";
import { ExtraDaysSummary } from "./extra-days-summary";
import { ReconciliationCard } from "./reconciliation-card";
import { BucketGrid } from "./bucket-grid";
import { BucketDialog } from "./bucket-dialog";
import { TargetDialog } from "./target-dialog";
import { AllocationDialog } from "./allocation-dialog";
import { AllocationHistory } from "./allocation-history";

interface ExtraDaysPageClientProps {
  data: ExtraDaysPlannerData;
}

export function ExtraDaysPageClient({ data }: ExtraDaysPageClientProps) {
  const [editingBucket, setEditingBucket] = useState<ExtraDayBucket | null>(null);
  const [editingTarget, setEditingTarget] = useState<ExtraDayTarget | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<ExtraDayAllocationDetail | null>(null);
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [defaultBucketId, setDefaultBucketId] = useState<number | null>(null);
  const [defaultTargetId, setDefaultTargetId] = useState<number | null>(null);

  const canAllocate = data.overAllocatedDays === 0 && data.remainingPlannerDays > 0;

  function openBucketDialog(bucket?: ExtraDayBucket) {
    setEditingBucket(bucket ?? null);
    setBucketDialogOpen(true);
  }

  function openTargetDialog(target?: ExtraDayTarget, bucketId?: number) {
    setEditingTarget(target ?? null);
    setDefaultBucketId(bucketId ?? target?.bucketId ?? null);
    setTargetDialogOpen(true);
  }

  function openAllocationDialog(allocation?: ExtraDayAllocationDetail, bucketId?: number, targetId?: number) {
    setEditingAllocation(allocation ?? null);
    setDefaultBucketId(bucketId ?? allocation?.bucketId ?? null);
    setDefaultTargetId(targetId ?? allocation?.targetId ?? null);
    setAllocationDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <ExtraDaysSummary data={data} />
      <ReconciliationCard data={data} />

      <BucketGrid
        buckets={data.buckets}
        canAllocate={canAllocate}
        onAddBucket={() => openBucketDialog()}
        onEditBucket={(bucket) => openBucketDialog(bucket)}
        onAddTarget={(bucketId) => openTargetDialog(undefined, bucketId)}
        onEditTarget={(target) => openTargetDialog(target)}
        onAddAllocation={(bucketId, targetId) => openAllocationDialog(undefined, bucketId, targetId)}
      />

      <AllocationHistory
        allocations={data.allocations}
        canAllocate={canAllocate}
        onEditAllocation={(allocation) => openAllocationDialog(allocation)}
      />

      <BucketDialog
        open={bucketDialogOpen}
        onClose={() => setBucketDialogOpen(false)}
        bucket={editingBucket}
      />

      <TargetDialog
        open={targetDialogOpen}
        onClose={() => setTargetDialogOpen(false)}
        target={editingTarget}
        buckets={data.buckets.map((bucketSummary) => bucketSummary.bucket)}
        defaultBucketId={defaultBucketId}
      />

      <AllocationDialog
        open={allocationDialogOpen}
        onClose={() => setAllocationDialogOpen(false)}
        allocation={editingAllocation}
        financialYear={data.financialYear}
        buckets={data.buckets}
        allocations={data.allocations}
        defaultBucketId={defaultBucketId}
        defaultTargetId={defaultTargetId}
        canAllocate={canAllocate}
      />
    </div>
  );
}
