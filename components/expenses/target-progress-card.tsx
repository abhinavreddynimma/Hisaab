"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import type { ExpenseTarget, ExpenseAccountType } from "@/lib/types";

interface TargetProgressCardProps {
  target: ExpenseTarget;
  onClick?: () => void;
}

export function TargetProgressCard({ target, onClick }: TargetProgressCardProps) {
  const thisMonthPct = target.monthlyAmount > 0 ? ((target.thisMonthActual ?? 0) / target.monthlyAmount) * 100 : 0;
  const fyAvgPct = target.monthlyAmount > 0 ? ((target.fyAverage ?? 0) / target.monthlyAmount) * 100 : 0;

  const barColor = thisMonthPct >= 80 ? "bg-emerald-500" : thisMonthPct >= 50 ? "bg-amber-400" : "bg-rose-400";

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPosition = (now.getDate() / daysInMonth) * 100;

  const typeConfig = target.accountType ? EXPENSE_ACCOUNT_TYPES[target.accountType as ExpenseAccountType] : null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{target.accountName}</h3>
          {typeConfig && (
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: typeConfig.color }}>
              {typeConfig.label}
            </Badge>
          )}
        </div>

        <div className="relative pt-4">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(thisMonthPct, 100)}%` }} />
          </div>
          <div className="absolute top-4 h-3 w-0.5 bg-gray-800 dark:bg-gray-200" style={{ left: `${todayPosition}%` }} title="Today" />
          <div className="absolute top-0 text-[9px] text-muted-foreground font-medium" style={{ left: `${todayPosition}%`, transform: "translateX(-50%)" }}>
            Today
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">This month</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(target.thisMonthActual ?? 0)} / {formatCurrency(target.monthlyAmount)}
              <span className={cn("ml-1", thisMonthPct >= 80 ? "text-emerald-600" : thisMonthPct >= 50 ? "text-amber-600" : "text-rose-600")}>
                ({thisMonthPct.toFixed(0)}%)
              </span>
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">FY average</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(target.fyAverage ?? 0)} / mo
              <span className={cn("ml-1", fyAvgPct >= 80 ? "text-emerald-600" : fyAvgPct >= 50 ? "text-amber-600" : "text-rose-600")}>
                ({fyAvgPct.toFixed(0)}%)
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
