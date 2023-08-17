"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface EarningsChartProps {
  data: { month: string; earnings: number }[];
}

export function EarningsChart({ data }: EarningsChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.earnings > 0);
  const monthsWithEarnings = data.filter((d) => d.earnings > 0);
  const average =
    monthsWithEarnings.length > 0
      ? monthsWithEarnings.reduce((sum, d) => sum + d.earnings, 0) / monthsWithEarnings.length
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Earnings</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.filter((d) => d.earnings > 0)}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <Tooltip
                formatter={(value: number | undefined) => [
                  formatCurrency(value ?? 0),
                  "Earnings",
                ]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              />
              <Bar dataKey="earnings" fill="url(#earningsGradient)" radius={[6, 6, 0, 0]} />
              <ReferenceLine
                y={average}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{ value: `Avg: ${formatCurrency(average)}`, position: "insideTopLeft", fill: "#f59e0b", fontSize: 12, fontWeight: 600 }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No earnings data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
