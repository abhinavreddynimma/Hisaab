"use client";

import type { ExtraDayBucket, ExtraDayBucketSummary, ExtraDayTarget } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { BucketCard } from "./bucket-card";

interface BucketGridProps {
  buckets: ExtraDayBucketSummary[];
  canAllocate: boolean;
  onAddBucket: () => void;
  onEditBucket: (bucket: ExtraDayBucket) => void;
  onAddTarget: (bucketId: number) => void;
  onEditTarget: (target: ExtraDayTarget) => void;
  onAddAllocation: (bucketId?: number, targetId?: number) => void;
}

export function BucketGrid({
  buckets,
  canAllocate,
  onAddBucket,
  onEditBucket,
  onAddTarget,
  onEditTarget,
  onAddAllocation,
}: BucketGridProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Buckets & Targets</h2>
          <p className="text-sm text-muted-foreground">
            Everything below lives only inside the Extra Days planner.
          </p>
        </div>
        <Button onClick={onAddBucket}>Add Bucket</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {buckets.map((bucketSummary) => (
          <BucketCard
            key={bucketSummary.bucket.id}
            bucketSummary={bucketSummary}
            canAllocate={canAllocate}
            onEditBucket={onEditBucket}
            onAddTarget={onAddTarget}
            onEditTarget={onEditTarget}
            onAddAllocation={onAddAllocation}
          />
        ))}
      </div>
    </section>
  );
}
