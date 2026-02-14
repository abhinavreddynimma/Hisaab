"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface RevenueSparklineProps {
  data: { month: string; earnings: number }[];
}

export function RevenueSparkline({ data }: RevenueSparklineProps) {
  // Compute cumulative revenue
  let cumulative = 0;
  const cumulativeData = data.map((d) => {
    cumulative += d.earnings;
    return { value: cumulative };
  });

  if (cumulativeData.length < 2 || cumulative === 0) return null;

  return (
    <div className="mt-2 -mx-5 -mb-5">
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={cumulativeData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={1.5}
            fill="url(#sparklineGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
