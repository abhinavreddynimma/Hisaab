import { cn } from "@/lib/utils";
import type { MonthSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface MonthSummaryProps {
  summary: MonthSummary;
  leaveBalance: number;
}

function StatItem({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          {label}
        </p>
        <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", className)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function MonthSummaryCard({ summary, leaveBalance }: MonthSummaryProps) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
      <StatItem label="Working Days" value={summary.workingDays} className="text-blue-600 dark:text-blue-400" />
      <StatItem label="Leaves" value={summary.leaves} className="text-red-600 dark:text-red-400" />
      <StatItem label="Holidays" value={summary.holidays} className="text-emerald-600 dark:text-emerald-400" />
      <StatItem label="Half Days" value={summary.halfDays} className="text-sky-600 dark:text-sky-400" />
      <StatItem label="Extra Working" value={summary.extraWorkingDays} className="text-purple-600 dark:text-purple-400" />
      <StatItem label="Effective Days" value={summary.effectiveWorkingDays} className="text-foreground font-bold" />
      <StatItem
        label="Leave Balance"
        value={leaveBalance}
        className={cn(
          leaveBalance < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        )}
      />
    </div>
  );
}
