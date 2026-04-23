"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveExtraDayBucket, createExtraDayBucket, updateExtraDayBucket } from "@/actions/extra-days";
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
import type { ExtraDayBucket } from "@/lib/types";

interface BucketDialogProps {
  open: boolean;
  onClose: () => void;
  bucket: ExtraDayBucket | null;
}

export function BucketDialog({ open, onClose, bucket }: BucketDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(bucket?.name ?? "");
  }, [bucket, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = bucket
      ? await updateExtraDayBucket(bucket.id, { name })
      : await createExtraDayBucket({ name });

    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save bucket");
      return;
    }

    toast.success(bucket ? "Bucket updated" : "Bucket created");
    router.refresh();
    onClose();
  }

  async function handleArchive() {
    if (!bucket) return;
    if (!window.confirm(`Archive bucket "${bucket.name}"?`)) return;

    const result = await archiveExtraDayBucket(bucket.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to archive bucket");
      return;
    }

    toast.success("Bucket archived");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bucket ? "Edit Bucket" : "Create Bucket"}</DialogTitle>
          <DialogDescription>
            Buckets are planner-only categories. They never write back into Dashboard, Calendar, Expenses, or any other module.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Bucket name</Label>
            <Input
              id="bucket-name"
              placeholder="Travel, Emergency Fund, Gear"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              {bucket?.isActive && (
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
                {saving ? "Saving..." : bucket ? "Save Changes" : "Create Bucket"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
