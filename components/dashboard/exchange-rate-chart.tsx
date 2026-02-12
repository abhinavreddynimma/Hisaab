"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ExchangeRateChartProps {
  data: { month: string; rate: number }[];
  liveRate: number | null;
  currency?: string;
}

export function ExchangeRateChart({ data, liveRate, currency = "EUR" }: ExchangeRateChartProps) {
  const withRates = data.filter((d) => d.rate > 0);

  // Append live rate as "Now" point
  const chartData = liveRate
    ? [...withRates, { month: "Live", rate: Math.round(liveRate * 100) / 100 }]
    : withRates;

  const hasData = chartData.length > 0;
  const rates = chartData.map((d) => d.rate);
  const maxRate = Math.ceil(Math.max(...rates) + 1);
  const minRate = Math.floor(Math.min(...rates) - 1);
  const avgRate =
    withRates.length > 0
      ? withRates.reduce((sum, d) => sum + d.rate, 0) / withRates.length
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{currency} to INR Rate</CardTitle>
        {liveRate && (
          <p className="text-sm tabular-nums text-muted-foreground">
            Live: <span className="font-semibold text-foreground">₹{liveRate.toFixed(2)}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis domain={[minRate, maxRate]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip
                formatter={(value: number | undefined) => [
                  `₹${(value ?? 0).toFixed(2)}`,
                  `${currency}/INR`,
                ]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="url(#rateGradient)"
                dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
              />
              <ReferenceLine
                y={avgRate}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: `Avg: ₹${avgRate.toFixed(2)}`, position: "insideTopLeft", fill: "#f59e0b", fontSize: 11, fontWeight: 600 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No exchange rate data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
