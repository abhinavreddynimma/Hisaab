"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import type { ExpenseBudget } from "@/lib/types";

interface BudgetProgressCardProps {
  budget: ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number };
  onClick?: () => void;
}

export function BudgetProgressCard({ budget, onClick }: BudgetProgressCardProps) {
  const percentage = budget.monthlyAmount > 0 ? (budget.spent / budget.monthlyAmount) * 100 : 0;
  const remaining = budget.monthlyAmount - budget.spent;
  const isOver = remaining < 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPosition = (now.getDate() / daysInMonth) * 100;

  const barColor = percentage > 100 ? "bg-red-500" : percentage > 80 ? "bg-amber-500" : percentage > 60 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{budget.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {budget.categoryNames.map(name => (
                <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">{name}</Badge>
              ))}
            </div>
          </div>
          {isOver && (
            <Badge variant="destructive" className="text-[10px]">Over by {formatCurrency(Math.abs(remaining))}</Badge>
          )}
        </div>

        <div className="relative pt-4">
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(percentage, 100)}%` }} />
          </div>
          <div className="absolute top-4 h-3 w-0.5 bg-gray-800 dark:bg-gray-200" style={{ left: `${todayPosition}%` }} title="Today" />
          <div className="absolute top-0 text-[9px] text-muted-foreground font-medium" style={{ left: `${todayPosition}%`, transform: "translateX(-50%)" }}>
            Today
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="tabular-nums">
            {formatCurrency(budget.spent)} <span className="text-muted-foreground">of {formatCurrency(budget.monthlyAmount)}</span>
          </span>
          <span className={cn("font-medium tabular-nums", isOver ? "text-red-600" : "text-muted-foreground")}>
            {isOver ? `${percentage.toFixed(0)}%` : `${formatCurrency(remaining)} left`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
