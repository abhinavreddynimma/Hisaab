"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { CategoryPieChart } from "./category-pie-chart";

interface StatsData {
  totalIncome: number;
  totalExpenses: number;
  totalTransfersOut: number;
  net: number;
  incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
  expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
  transfersByType: { type: string; amount: number; percentage: number }[];
  topLevelSplit: {
    postTaxIncome: number;
    investments: { amount: number; percentage: number };
    savings: { amount: number; percentage: number };
    expenses: { amount: number; percentage: number };
  };
}

interface StatsViewProps {
  stats: StatsData;
  fyStats: StatsData;
  fyOverview: {
    months: { month: string; year: number; monthNum: number; income: number; expense: number; net: number }[];
    totalIncome: number;
    totalExpenses: number;
  };
  currentMonth: number;
  currentYear: number;
  financialYear: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function StatsView({ stats, fyStats, fyOverview, currentMonth, currentYear, financialYear }: StatsViewProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<"month" | "fy">("month");
  const [view, setView] = useState<"expense" | "income">("expense");

  const activeStats = period === "month" ? stats : fyStats;

  const outflowData = [
    ...activeStats.expenseByCategory.map(c => ({ id: c.id, name: c.name, value: c.amount, color: c.color })),
    ...activeStats.transfersByType.map(t => ({ id: 0, name: t.type, value: t.amount, color: t.type === "Investments" ? "#6366f1" : "#f59e0b" })),
  ];

  const incomeData = activeStats.incomeByCategory.map(c => ({ id: c.id, name: c.name, value: c.amount, color: c.color }));

  const periodLabel = period === "month"
    ? `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`
    : `FY ${financialYear}`;

  return (
    <div className="space-y-6">
      {/* Period toggle + Income/Expense toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setPeriod("month")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPeriod("fy")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === "fy" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            FY {financialYear}
          </button>
        </div>

        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setView("expense")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              view === "expense" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Expenses {formatCurrency(activeStats.totalExpenses + activeStats.totalTransfersOut)}
          </button>
          <button
            type="button"
            onClick={() => setView("income")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              view === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Income {formatCurrency(activeStats.totalIncome)}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Income</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(activeStats.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Expenses</p>
            <p className="text-lg font-bold tabular-nums text-rose-600">{formatCurrency(activeStats.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Transfers</p>
            <p className="text-lg font-bold tabular-nums text-violet-600">{formatCurrency(activeStats.totalTransfersOut)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Net</p>
            <p className={`text-lg font-bold tabular-nums ${activeStats.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {activeStats.net >= 0 ? "+" : ""}{formatCurrency(activeStats.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 50:20:30 Split (post-tax) */}
      {activeStats.topLevelSplit.postTaxIncome > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Post-Tax Split — {periodLabel}
            </p>
            <div className="flex h-4 rounded-full overflow-hidden mb-3">
              {activeStats.topLevelSplit.investments.percentage > 0 && (
                <div className="bg-indigo-500 transition-all" style={{ width: `${activeStats.topLevelSplit.investments.percentage}%` }} title={`Investments ${activeStats.topLevelSplit.investments.percentage}%`} />
              )}
              {activeStats.topLevelSplit.savings.percentage > 0 && (
                <div className="bg-amber-400 transition-all" style={{ width: `${activeStats.topLevelSplit.savings.percentage}%` }} title={`Savings ${activeStats.topLevelSplit.savings.percentage}%`} />
              )}
              {activeStats.topLevelSplit.expenses.percentage > 0 && (
                <div className="bg-rose-400 transition-all" style={{ width: `${activeStats.topLevelSplit.expenses.percentage}%` }} title={`Expenses ${activeStats.topLevelSplit.expenses.percentage}%`} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs text-muted-foreground">Investments</span>
                </div>
                <p className="text-sm font-bold tabular-nums">{activeStats.topLevelSplit.investments.percentage}%</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(activeStats.topLevelSplit.investments.amount)}</p>
                <p className="text-[10px] text-muted-foreground/60">target: 50%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-muted-foreground">Savings</span>
                </div>
                <p className="text-sm font-bold tabular-nums">{activeStats.topLevelSplit.savings.percentage}%</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(activeStats.topLevelSplit.savings.amount)}</p>
                <p className="text-[10px] text-muted-foreground/60">target: 20%</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="text-xs text-muted-foreground">Expenses</span>
                </div>
                <p className="text-sm font-bold tabular-nums">{activeStats.topLevelSplit.expenses.percentage}%</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(activeStats.topLevelSplit.expenses.amount)}</p>
                <p className="text-[10px] text-muted-foreground/60">target: 30%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pie chart */}
      <CategoryPieChart
        data={view === "expense" ? outflowData : incomeData}
        title={`${view === "expense" ? "Where money went" : "Income sources"} — ${periodLabel}`}
        onCategoryClick={(id) => id > 0 && router.push(`/expenses/${id}`)}
      />

      {/* Category breakdown list */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {(view === "expense" ? outflowData : incomeData).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
            ) : (
              (view === "expense" ? outflowData : incomeData).map((item, idx) => {
                const total = view === "expense"
                  ? activeStats.totalExpenses + activeStats.totalTransfersOut
                  : activeStats.totalIncome;
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2"
                    onClick={() => item.id > 0 && router.push(`/expenses/${item.id}`)}
                  >
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: item.color || "#94a3b8" }}
                    >
                      {pct}%
                    </span>
                    <span className="flex-1 text-sm font-medium">{item.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.value)}</span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
