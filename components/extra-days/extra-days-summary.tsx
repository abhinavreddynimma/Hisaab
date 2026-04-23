"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ExtraDaysPlannerData } from "@/lib/types";

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface ExtraDaysSummaryProps {
  data: ExtraDaysPlannerData;
}

export function ExtraDaysSummary({ data }: ExtraDaysSummaryProps) {
  const items = [
    {
      label: "Leave Balance",
      value: data.balanceData.leaveBalance,
      helper: `${formatDays(data.balanceData.leavesAllowed)} allowed - ${formatDays(data.balanceData.leavesTaken)} used`,
      tone: data.balanceData.leaveBalance >= 0 ? "text-emerald-600" : "text-rose-600",
    },
    {
      label: "Extra Working Days",
      value: data.balanceData.totalExtraWorking,
      helper: "Read-only from Calendar, capped at today",
      tone: "text-violet-600",
    },
    {
      label: "Allocatable Extra Days",
      value: data.allocatableDays,
      helper: `Today-capped balance: ${formatDays(data.rawExtraBalance)}`,
      tone: data.allocatableDays > 0 ? "text-emerald-600" : "text-foreground",
    },
    {
      label: "Remaining In Planner",
      value: data.overAllocatedDays > 0 ? -data.overAllocatedDays : data.remainingPlannerDays,
      helper: data.overAllocatedDays > 0
        ? `Over-allocated by ${formatDays(data.overAllocatedDays)}`
        : `${formatDays(data.allocatedDays)} already assigned`,
      tone: data.overAllocatedDays > 0
        ? "text-rose-600"
        : data.remainingPlannerDays > 0
          ? "text-emerald-600"
          : "text-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </p>
            <p className={`text-3xl font-semibold tabular-nums ${item.tone}`}>
              {item.value > 0 ? "+" : ""}
              {formatDays(item.value)}
            </p>
            <p className="text-sm text-muted-foreground">{item.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
