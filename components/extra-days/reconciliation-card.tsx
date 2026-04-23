"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExtraDaysPlannerData } from "@/lib/types";

function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface ReconciliationCardProps {
  data: ExtraDaysPlannerData;
}

export function ReconciliationCard({ data }: ReconciliationCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Planner Reconciliation</CardTitle>
          <p className="text-sm text-muted-foreground">
            This page only reads your FY balance up to today. Nothing here writes back to Calendar, Dashboard, Expenses, or any existing module.
          </p>
        </div>
        {data.overAllocatedDays > 0 ? (
          <Badge variant="destructive">Over-allocated</Badge>
        ) : (
          <Badge variant="secondary">Read-only source</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Leave Balance</p>
            <p className="mt-2 text-lg font-semibold">
              {formatDays(data.balanceData.leavesAllowed)} allowed - {formatDays(data.balanceData.leavesTaken)} used
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              = {formatDays(data.balanceData.leaveBalance)} days
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Allocatable Pool</p>
            <p className="mt-2 text-lg font-semibold">
              {formatDays(data.balanceData.leaveBalance)} leave balance + {formatDays(data.balanceData.totalExtraWorking)} extra working
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              = {formatDays(data.allocatableDays)} usable days in planner as of today
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Planner Usage</p>
            <p className="mt-2 text-lg font-semibold">
              {formatDays(data.allocatedDays)} allocated
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.overAllocatedDays > 0
                ? `${formatDays(data.overAllocatedDays)} above the current pool`
                : `${formatDays(data.remainingPlannerDays)} still free inside planner`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Full Working Day Granularity
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total weekdays</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.totalWeekdays)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Public holidays on weekdays</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.publicHolidayWeekdays)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total possible work days</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.totalPossibleWorkDays)}</p>
              <p className="text-xs text-muted-foreground">Weekdays - weekday public holidays</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Leaves taken</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.leavesTaken)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total days worked</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.totalDaysWorked)}</p>
              <p className="text-xs text-muted-foreground">Possible work days - leaves taken</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Extra working on public holidays</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.extraWorkingPublicHolidays)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Extra working on weekends</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.extraWorkingWeekends)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total extra working</p>
              <p className="text-lg font-semibold tabular-nums">{formatDays(data.balanceData.totalExtraWorking)}</p>
              <p className="text-xs text-muted-foreground">
                ({formatDays(data.balanceData.extraWorkingPublicHolidays)} public holidays, {formatDays(data.balanceData.extraWorkingWeekends)} weekends)
              </p>
            </div>
          </div>
        </div>

        {data.overAllocatedDays > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            Calendar data changed after allocations were saved, so the planner is currently over-allocated by{" "}
            <span className="font-semibold">{formatDays(data.overAllocatedDays)} days</span>. New allocations are blocked until you
            reduce or delete some existing planner entries.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
