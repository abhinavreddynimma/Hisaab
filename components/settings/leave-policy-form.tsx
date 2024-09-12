"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveLeavePolicy } from "@/actions/settings";
import type { LeavePolicy } from "@/lib/types";

interface LeavePolicyFormProps {
  initialData: LeavePolicy;
}

export function LeavePolicyForm({ initialData }: LeavePolicyFormProps) {
  const [formData, setFormData] = useState<LeavePolicy>(initialData);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string | number) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveLeavePolicy(formData);
      if (result.success) {
        toast.success("Leave policy saved successfully");
      }
    } catch {
      toast.error("Failed to save leave policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Policy Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leavesPerMonth">Leaves Per Month</Label>
              <Input
                id="leavesPerMonth"
                type="number"
                min={0}
                step={0.5}
                value={formData.leavesPerMonth}
                onChange={(e) =>
                  handleChange("leavesPerMonth", parseFloat(e.target.value) || 0)
                }
                placeholder="Number of leaves per month"
              />
              <p className="text-sm text-muted-foreground">
                Number of paid leaves allocated per month.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="standardWorkingDays">Standard Working Days</Label>
              <Input
                id="standardWorkingDays"
                type="number"
                min={1}
                max={31}
                value={formData.standardWorkingDays}
                onChange={(e) =>
                  handleChange(
                    "standardWorkingDays",
                    parseInt(e.target.value, 10) || 0
                  )
                }
                placeholder="Working days per month"
              />
              <p className="text-sm text-muted-foreground">
                Standard number of working days in a month (typically 22).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualDaysOffTarget">Annual Days Off Target</Label>
              <Input
                id="annualDaysOffTarget"
                type="number"
                min={0}
                step={0.5}
                value={formData.annualDaysOffTarget}
                onChange={(e) =>
                  handleChange("annualDaysOffTarget", parseFloat(e.target.value) || 0)
                }
                placeholder="Target days off per year"
              />
              <p className="text-sm text-muted-foreground">
                Burnout indicator target (leaves + public holidays not worked).
              </p>
            </div>
          </div>
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="trackingStartDate">Tracking Start Date</Label>
            <Input
              id="trackingStartDate"
              type="month"
              value={formData.trackingStartDate}
              onChange={(e) =>
                handleChange("trackingStartDate", e.target.value)
              }
            />
            <p className="text-sm text-muted-foreground">
              Month from which leave tracking begins (YYYY-MM).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Leave Policy"}
        </Button>
      </div>
    </form>
  );
}
