"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_COLORS = [
  "#f43f5e", "#6366f1", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface CategoryPieChartProps {
  data: { id: number; name: string; value: number; color: string | null }[];
  title: string;
  onCategoryClick?: (id: number) => void;
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const pct = Math.round((percent ?? 0) * 100);
  if (pct < 5) return null;

  const radius = ((innerRadius ?? 0) + (outerRadius ?? 100)) / 2;
  const x = cx + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = cy + radius * Math.sin(-(midAngle ?? 0) * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize={12}
      fontWeight={700}
    >
      {pct}%
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold">{name}</p>
      <p className="text-sm text-muted-foreground tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}

export function CategoryPieChart({ data, title, onCategoryClick }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              nameKey="name"
              paddingAngle={1}
              strokeWidth={1}
              stroke="rgba(255,255,255,0.5)"
              onClick={(_, idx) => onCategoryClick?.(data[idx].id)}
              style={{ cursor: "pointer" }}
              label={renderLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Category list below */}
        <div className="space-y-2 mt-2">
          {data.map((item, idx) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            return (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5"
                onClick={() => onCategoryClick?.(item.id)}
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {pct}%
                </span>
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
