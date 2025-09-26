"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_COLORS = [
  "#f43f5e", "#6366f1", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface SubCategory {
  id: number;
  name: string;
  amount: number;
  percentage: number;
  color: string | null;
}

interface PieDataItem {
  id: number;
  name: string;
  value: number;
  color: string | null;
  subCategories?: SubCategory[];
}

interface CategoryPieChartProps {
  data: PieDataItem[];
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
  const [drillDown, setDrillDown] = useState<{ parent: PieDataItem; subData: PieDataItem[] } | null>(null);

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

  const activeData = drillDown
    ? drillDown.subData
    : data;
  const activeTitle = drillDown
    ? `${drillDown.parent.name} breakdown`
    : title;
  const total = activeData.reduce((s, d) => s + d.value, 0);

  function handlePieClick(idx: number) {
    if (drillDown) {
      // Already drilled down — clicking sub-category navigates to detail
      onCategoryClick?.(activeData[idx].id);
      return;
    }

    const item = data[idx];
    if (item.subCategories && item.subCategories.length > 0) {
      setDrillDown({
        parent: item,
        subData: item.subCategories.map(sc => ({
          id: sc.id,
          name: sc.name,
          value: sc.amount,
          color: sc.color,
        })),
      });
    } else {
      onCategoryClick?.(item.id);
    }
  }

  function handleListClick(item: PieDataItem) {
    onCategoryClick?.(item.id);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {drillDown && (
            <button
              type="button"
              onClick={() => setDrillDown(null)}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <CardTitle className="text-base">{activeTitle}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={activeData}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              nameKey="name"
              paddingAngle={1}
              strokeWidth={1}
              stroke="rgba(255,255,255,0.5)"
              onClick={(_, idx) => handlePieClick(idx)}
              style={{ cursor: "pointer" }}
              label={renderLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {activeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Category list below */}
        <div className="space-y-2 mt-2">
          {activeData.map((item, idx) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const hasSubCats = !drillDown && item.subCategories && item.subCategories.length > 0;
            return (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5"
                onClick={() => handleListClick(item)}
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {pct}%
                </span>
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                {hasSubCats && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrillDown({
                        parent: item,
                        subData: item.subCategories!.map(sc => ({
                          id: sc.id, name: sc.name, value: sc.amount, color: sc.color,
                        })),
                      });
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/50 hover:border-border transition-colors"
                  >
                    split
                  </button>
                )}
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
