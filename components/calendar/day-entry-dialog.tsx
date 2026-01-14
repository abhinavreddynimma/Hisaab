"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { DAY_TYPES } from "@/lib/constants";
import type { DayType } from "@/lib/constants";
import type { DayEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { upsertDayEntry, deleteDayEntry } from "@/actions/day-entries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DayEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  entry: DayEntry | null;
  projects: { id: number; name: string; clientName: string }[];
  defaultProjectId: number | null;
  onSave: () => void;
}

export function DayEntryDialog({
  open,
  onOpenChange,
  date,
  entry,
  projects,
  defaultProjectId,
  onSave,
}: DayEntryDialogProps) {
  const [dayType, setDayType] = useState<DayType>("working");
  const [projectId, setProjectId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDayType(entry?.dayType ?? "working");
      setProjectId(
        entry?.projectId
          ? String(entry.projectId)
          : defaultProjectId
            ? String(defaultProjectId)
            : ""
      );
      setNotes(entry?.notes ?? "");
    }
  }, [open, entry, defaultProjectId]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertDayEntry({
        date,
        dayType,
        projectId: projectId ? Number(projectId) : null,
        notes: notes || undefined,
      });
      toast.success("Day entry saved");
      onOpenChange(false);
      onSave();
    } catch {
      toast.error("Failed to save day entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteDayEntry(date);
      toast.success("Day entry deleted");
      onOpenChange(false);
      onSave();
    } catch {
      toast.error("Failed to delete day entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Day Entry</DialogTitle>
          <DialogDescription>{formatDate(date)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="day-type">Day Type</Label>
            <Select value={dayType} onValueChange={(v) => setDayType(v as DayType)}>
              <SelectTrigger id="day-type">
                <SelectValue placeholder="Select day type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DAY_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${config.color}`} />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project">Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name} ({project.clientName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          {entry && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
