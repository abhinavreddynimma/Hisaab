"use client";

import { useState, useTransition, useEffect } from "react";
import { Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, ReferenceLine, Label } from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import { getBudgetMonthlyTrend } from "@/actions/expenses";
import type { ExpenseBudget } from "@/lib/types";

function formatCompact(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v.toFixed(0)}`;
}

const DEFAULT_COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface BudgetProgressCardProps {
  budget: ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number };
  financialYear: string;
  onEdit?: () => void;
}

export function BudgetProgressCard({ budget, financialYear, onEdit }: BudgetProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [trendData, setTrendData] = useState<{
    months: { month: string; amount: number }[];
    average: number;
    categoryBreakdown: { name: string; amount: number; color: string | null }[];
  } | null>(null);
  const [loading, startTransition] = useTransition();

  // Auto-load trend data on mount for average
  useEffect(() => {
    if (!trendData) {
      getBudgetMonthlyTrend(budget.id, financialYear).then(setTrendData);
    }
  }, [budget.id, financialYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const percentage = budget.monthlyAmount > 0 ? (budget.spent / budget.monthlyAmount) * 100 : 0;
  const remaining = budget.monthlyAmount - budget.spent;
  const isOver = remaining < 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPosition = (now.getDate() / daysInMonth) * 100;
  const daysLeft = daysInMonth - now.getDate();
  const dailyBurnRemaining = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

  const barColor = percentage > 100 ? "bg-red-500" : percentage > 80 ? "bg-amber-500" : percentage > 60 ? "bg-amber-400" : "bg-emerald-500";

  function handleToggleExpand() {
    if (!expanded && !trendData) {
      startTransition(async () => {
        const data = await getBudgetMonthlyTrend(budget.id, financialYear);
        setTrendData(data);
      });
    }
    setExpanded(!expanded);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDotLabel = (props: any) => {
    const { x, y, value } = props;
    if (!value || value === 0) return null;
    const label = value >= 100000 ? `${(value / 100000).toFixed(1)}L` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString();
    return (
      <text x={x} y={y - 12} textAnchor="middle" className="fill-foreground" fontSize={10} fontWeight={600}>
        {label}
      </text>
    );
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 cursor-pointer" onClick={handleToggleExpand}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{budget.name}</h3>
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {budget.categoryNames.map(name => (
                <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">{name}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOver && (
              <Badge variant="destructive" className="text-[10px]">Over by {formatCurrency(Math.abs(remaining))}</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative pt-4 cursor-pointer" onClick={handleToggleExpand}>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(percentage, 100)}%` }} />
          </div>
          <div className="absolute top-4 h-3 w-0.5 bg-gray-800 dark:bg-gray-200" style={{ left: `${todayPosition}%` }} title="Today" />
          <div className="absolute top-0 text-[9px] text-muted-foreground font-medium" style={{ left: `${todayPosition}%`, transform: "translateX(-50%)" }}>
            Today
          </div>
        </div>

        {/* Summary */}
        <div className="flex justify-between text-xs">
          <span className="tabular-nums">
            {formatCurrency(budget.spent)} <span className="text-muted-foreground">of {formatCurrency(budget.monthlyAmount)}</span>
            {trendData && trendData.average > 0 && (
              <span className="text-muted-foreground ml-2">· avg {formatCurrency(trendData.average)}/mo</span>
            )}
          </span>
          <span className={cn("font-medium tabular-nums", isOver ? "text-amber-600" : "text-muted-foreground")}>
            {trendData && trendData.average > 0
              ? `${(budget.monthlyAmount > 0 ? (trendData.average / budget.monthlyAmount) * 100 : 0).toFixed(0)}% avg`
              : isOver ? `${percentage.toFixed(0)}%` : `${formatCurrency(remaining)} left`
            }
          </span>
        </div>

        {/* Daily burn rate */}
        {!isOver && daysLeft > 0 && remaining > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {formatCurrency(dailyBurnRemaining)}/day for {daysLeft} days remaining
          </p>
        )}

        {/* Expanded: Monthly trend chart + category breakdown */}
        {expanded && (
          <div className="border-t pt-3 space-y-4">
            {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>}
            {trendData && (
              <>
                {/* Line chart */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly Spending — FY {financialYear}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData.months} margin={{ top: 25, right: 15, left: 15, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Spent"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />

                      {/* Monthly average */}
                      {trendData.average > 0 && (
                        <ReferenceLine y={trendData.average} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1}>
                          <Label value={`avg ${formatCompact(trendData.average)}`} position="insideTopRight" className="fill-muted-foreground" fontSize={9} dy={-2} />
                        </ReferenceLine>
                      )}

                      {/* Budget line */}
                      <ReferenceLine y={budget.monthlyAmount} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5}>
                        <Label value={`budget ${formatCompact(budget.monthlyAmount)}`} position="insideTopLeft" className="fill-amber-600" fontSize={9} dy={-2} />
                      </ReferenceLine>

                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                        label={renderDotLabel}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Category breakdown */}
                {trendData.categoryBreakdown.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category Split — FY {financialYear}</p>
                    <div className="space-y-1.5">
                      {trendData.categoryBreakdown.map((cat, idx) => {
                        const total = trendData.categoryBreakdown.reduce((s, c) => s + c.amount, 0);
                        const pct = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
                        const color = cat.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                        return (
                          <div key={cat.name} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="flex-1 text-xs truncate">{cat.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                            <span className="text-xs font-medium tabular-nums">{formatCurrency(cat.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
