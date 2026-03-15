"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { CategoryPieChart } from "./category-pie-chart";

interface StatsViewProps {
  stats: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfersOut: number;
    net: number;
    incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    transfersByType: { type: string; amount: number; percentage: number }[];
  };
  currentMonth: number;
  currentYear: number;
  financialYear: string;
}

export function StatsView({ stats }: StatsViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"expense" | "income">("expense");

  const outflowData = [
    ...stats.expenseByCategory.map(c => ({ id: c.id, name: c.name, value: c.amount, color: c.color })),
    ...stats.transfersByType.map(t => ({ id: 0, name: t.type, value: t.amount, color: t.type === "Investments" ? "#6366f1" : "#f59e0b" })),
  ];

  const incomeData = stats.incomeByCategory.map(c => ({ id: c.id, name: c.name, value: c.amount, color: c.color }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setView("expense")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              view === "expense" ? "bg-rose-100 text-rose-700" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Expenses {formatCurrency(stats.totalExpenses + stats.totalTransfersOut)}
          </button>
          <button
            type="button"
            onClick={() => setView("income")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              view === "income" ? "bg-emerald-100 text-emerald-700" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Income {formatCurrency(stats.totalIncome)}
          </button>
        </div>
      </div>

      <CategoryPieChart
        data={view === "expense" ? outflowData : incomeData}
        title={view === "expense" ? "Where money went" : "Income sources"}
        onCategoryClick={(id) => id > 0 && router.push(`/expenses/${id}`)}
      />

      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {(view === "expense" ? outflowData : incomeData).map((item, idx) => {
              const total = view === "expense"
                ? stats.totalExpenses + stats.totalTransfersOut
                : stats.totalIncome;
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
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
