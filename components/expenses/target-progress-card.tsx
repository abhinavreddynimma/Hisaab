"use client";

import { useState, useTransition, useEffect } from "react";
import { Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, ReferenceLine, Label } from "recharts";
import { formatCurrency, formatCompact, cn } from "@/lib/utils";
import { getTargetMonthlyTrend } from "@/actions/expenses";
import type { ExpenseTarget } from "@/lib/types";

const DEFAULT_COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface TargetProgressCardProps {
  target: ExpenseTarget & { accountIds?: number[]; accountNames?: string[]; thisMonthActual?: number; fyAverage?: number };
  financialYear: string;
  onEdit?: () => void;
}

export function TargetProgressCard({ target, financialYear, onEdit }: TargetProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [trendData, setTrendData] = useState<{
    months: { month: string; amount: number }[];
    average: number;
    accountBreakdown: { name: string; amount: number; color: string | null }[];
  } | null>(null);
  const [loading, startTransition] = useTransition();

  // Auto-load trend data on mount for average
  useEffect(() => {
    if (!trendData) {
      getTargetMonthlyTrend(target.id, financialYear).then(setTrendData);
    }
  }, [target.id, financialYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const thisMonthPct = target.monthlyAmount > 0 ? ((target.thisMonthActual ?? 0) / target.monthlyAmount) * 100 : 0;
  const fyAvg = trendData?.average ?? (target.fyAverage ?? 0);
  const fyAvgPct = target.monthlyAmount > 0 ? (fyAvg / target.monthlyAmount) * 100 : 0;

  // Green when hitting target, amber when close, rose when far behind
  const barColor = thisMonthPct >= 80 ? "bg-emerald-500" : thisMonthPct >= 50 ? "bg-amber-400" : "bg-rose-400";

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayPosition = (now.getDate() / daysInMonth) * 100;
  const remaining = target.monthlyAmount - (target.thisMonthActual ?? 0);

  function handleToggleExpand() {
    if (!expanded && !trendData) {
      startTransition(async () => {
        const data = await getTargetMonthlyTrend(target.id, financialYear);
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
              <h3 className="font-semibold text-sm">{target.name}</h3>
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            {target.accountNames && target.accountNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {target.accountNames.map(name => (
                  <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">{name}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {remaining > 0 && (
              <Badge variant="secondary" className="text-[10px]">{formatCurrency(remaining)} left</Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative pt-4 cursor-pointer" onClick={handleToggleExpand}>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(thisMonthPct, 100)}%` }} />
          </div>
          <div className="absolute top-4 h-3 w-0.5 bg-gray-800 dark:bg-gray-200" style={{ left: `${todayPosition}%` }} title="Today" />
          <div className="absolute top-0 text-[9px] text-muted-foreground font-medium" style={{ left: `${todayPosition}%`, transform: "translateX(-50%)" }}>
            Today
          </div>
        </div>

        {/* Summary */}
        <div className="flex justify-between text-xs">
          <span className="tabular-nums">
            {formatCurrency(target.thisMonthActual ?? 0)} <span className="text-muted-foreground">of {formatCurrency(target.monthlyAmount)}</span>
            {fyAvg > 0 && (
              <span className="text-muted-foreground ml-2">· avg {formatCurrency(fyAvg)}/mo</span>
            )}
          </span>
          <span className={cn("font-medium tabular-nums", fyAvgPct >= 80 ? "text-emerald-600" : fyAvgPct >= 50 ? "text-amber-600" : "text-rose-600")}>
            {fyAvgPct.toFixed(0)}% avg
          </span>
        </div>

        {/* Expanded: Monthly trend chart + account breakdown */}
        {expanded && (
          <div className="border-t pt-3 space-y-4">
            {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>}
            {trendData && (
              <>
                {/* Line chart */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly Transfers — FY {financialYear}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData.months} margin={{ top: 25, right: 15, left: 15, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Transferred"]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />

                      {/* Monthly average */}
                      {trendData.average > 0 && (
                        <ReferenceLine y={trendData.average} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1}>
                          <Label value={`avg ${formatCompact(trendData.average)}`} position="insideTopRight" className="fill-muted-foreground" fontSize={9} dy={-2} />
                        </ReferenceLine>
                      )}

                      {/* Target line */}
                      <ReferenceLine y={target.monthlyAmount} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5}>
                        <Label value={`target ${formatCompact(target.monthlyAmount)}`} position="insideTopLeft" className="fill-emerald-600" fontSize={9} dy={-2} />
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

                {/* Account breakdown */}
                {trendData.accountBreakdown.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account Split — FY {financialYear}</p>
                    <div className="space-y-1.5">
                      {trendData.accountBreakdown.map((acc, idx) => {
                        const total = trendData.accountBreakdown.reduce((s, a) => s + a.amount, 0);
                        const pct = total > 0 ? Math.round((acc.amount / total) * 100) : 0;
                        const color = acc.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                        return (
                          <div key={acc.name} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="flex-1 text-xs truncate">{acc.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                            <span className="text-xs font-medium tabular-nums">{formatCurrency(acc.amount)}</span>
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
