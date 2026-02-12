import { cn } from "@/lib/utils";
import type { MonthSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface MonthSummaryProps {
  summary: MonthSummary;
  leaveBalance: number;
}

function StatItem({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("text-xl font-bold tabular-nums", className)}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export function MonthSummaryCard({ summary, leaveBalance }: MonthSummaryProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <StatItem label="Working Days" value={summary.workingDays} className="text-blue-600" />
        <StatItem label="Leaves" value={summary.leaves} className="text-red-600" />
        <StatItem label="Holidays" value={summary.holidays} className="text-green-600" />
        <StatItem label="Half Days" value={summary.halfDays} className="text-sky-600" />
        <StatItem label="Extra Working" value={summary.extraWorkingDays} className="text-purple-600" />
        <StatItem label="Effective Days" value={summary.effectiveWorkingDays} className="text-foreground" />
        <StatItem
          label="Leave Balance"
          value={leaveBalance}
          className={cn(
            leaveBalance < 0 ? "text-red-600" : "text-green-600"
          )}
        />
      </CardContent>
    </Card>
  );
}
