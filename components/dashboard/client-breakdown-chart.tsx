"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const COLORS = [
  ["#6366f1", "#818cf8"],
  ["#f43f5e", "#fb7185"],
  ["#10b981", "#34d399"],
  ["#f59e0b", "#fbbf24"],
  ["#8b5cf6", "#a78bfa"],
  ["#ec4899", "#f472b6"],
  ["#14b8a6", "#2dd4bf"],
  ["#f97316", "#fb923c"],
];

interface ClientBreakdownChartProps {
  data: { name: string; value: number }[];
}

export function ClientBreakdownChart({ data }: ClientBreakdownChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings by Client</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                {data.map((_, index) => {
                  const [start, end] = COLORS[index % COLORS.length];
                  return (
                    <linearGradient key={`pieGrad-${index}`} id={`pieGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={start} stopOpacity={1} />
                      <stop offset="100%" stopColor={end} stopOpacity={0.85} />
                    </linearGradient>
                  );
                })}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#pieGrad-${index})`}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined) => [
                  formatCurrency(value ?? 0),
                  "Earnings",
                ]}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 13 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No client data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
