"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface WorkingDaysChartProps {
  data: { month: string; working: number; leaves: number; holidays: number }[];
}

export function WorkingDaysChart({ data }: WorkingDaysChartProps) {
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Days vs Leaves</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="working"
                stackId="a"
                fill="#3b82f6"
                name="Working"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="leaves"
                stackId="a"
                fill="#ef4444"
                name="Leaves"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="holidays"
                stackId="a"
                fill="#22c55e"
                name="Holidays"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No working days data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
