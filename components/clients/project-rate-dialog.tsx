"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { updateProjectDailyRate } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCurrencySymbol } from "@/lib/constants";
import type { Project } from "@/lib/types";

interface ProjectRateDialogProps {
  project: Project;
  onSuccess?: () => void;
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function ProjectRateDialog({ project, onSuccess }: ProjectRateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dailyRate, setDailyRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(getTodayDateString());

  const currentRate = useMemo(
    () => project.currentDailyRate ?? project.defaultDailyRate,
    [project.currentDailyRate, project.defaultDailyRate],
  );

  function resetForm() {
    setDailyRate(String(currentRate));
    setEffectiveFrom(getTodayDateString());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsedRate = parseFloat(dailyRate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      toast.error("Please enter a valid daily rate");
      return;
    }

    if (!effectiveFrom) {
      toast.error("Please select the applicable date");
      return;
    }

    setLoading(true);
    try {
      const result = await updateProjectDailyRate(project.id, parsedRate, effectiveFrom);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update daily rate");
        return;
      }

      toast.success(`Daily rate updated from ${effectiveFrom}`);
      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error("Failed to update daily rate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit Rate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Daily Rate</DialogTitle>
          <DialogDescription>
            Set the new per-day cost and when it becomes applicable. This date is used for invoice auto-population.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`dailyRate-${project.id}`}>
              Daily Rate ({getCurrencySymbol(project.currency)})
            </Label>
            <Input
              id={`dailyRate-${project.id}`}
              type="number"
              min="0"
              step="0.01"
              value={dailyRate}
              onChange={(event) => setDailyRate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`effectiveFrom-${project.id}`}>Applicable From</Label>
            <Input
              id={`effectiveFrom-${project.id}`}
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
