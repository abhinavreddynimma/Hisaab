"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

interface BalanceOverviewProps {
  balanceData: {
    leaveBalance: number;
    totalExtraWorking: number;
    extraBalance: number;
    leavesAllowed: number;
    leavesTaken: number;
  };
  monthlyData: {
    month: string;
    working: number;
    leaves: number;
    extraWorking: number;
    halfDays: number;
  }[];
}

interface BalanceDetail {
  icon: "plus" | "minus";
  value: number;
  color: string;
}

function BalanceCard({
  label,
  value,
  colorClass,
  details,
}: {
  label: string;
  value: number;
  colorClass: string;
  details?: BalanceDetail[];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={cn("text-3xl font-bold tabular-nums mt-1", colorClass)}>
          {value >= 0 ? `+${value}` : value}
        </p>
        {details && details.length > 0 && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground justify-end">
            {details.map((d, i) => (
              <span key={i} className="flex items-center gap-1">
                {d.icon === "plus" ? (
                  <Plus className={cn("h-3 w-3", d.color)} />
                ) : (
                  <Minus className={cn("h-3 w-3", d.color)} />
                )}
                {d.value}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TooltipEntry {
  working: number;
  leaves: number;
  extraWorking: number;
  halfDays: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: TooltipEntry }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const rows = [
    { label: "Working", value: d.working, color: "#10b981" },
    { label: "Extra", value: d.extraWorking, color: "#8b5cf6" },
    { label: "Half Day", value: d.halfDays, color: "#f59e0b" },
    { label: "Leave", value: d.leaves, color: "#ef4444" },
  ].filter((r) => r.value > 0);

  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-semibold text-gray-900">{label}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
          <span className="text-gray-600">{r.label}</span>
          <span className="ml-auto font-medium tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BalanceOverview({ balanceData, monthlyData }: BalanceOverviewProps) {
  const hasData = monthlyData.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <BalanceCard
          label="Leave Balance"
          value={balanceData.leaveBalance}
          colorClass={balanceData.leaveBalance >= 0 ? "text-green-600" : "text-red-600"}
          details={[
            { icon: "plus", value: balanceData.leavesAllowed, color: "text-green-500" },
            { icon: "minus", value: balanceData.leavesTaken, color: "text-red-500" },
          ]}
        />
        <BalanceCard
          label="Extra Working Days"
          value={balanceData.totalExtraWorking}
          colorClass="text-purple-600"
        />
        <BalanceCard
          label="Extra Balance"
          value={balanceData.extraBalance}
          colorClass={balanceData.extraBalance >= 0 ? "text-green-600" : "text-red-600"}
          details={[
            { icon: "plus", value: balanceData.leavesAllowed, color: "text-green-500" },
            { icon: "plus", value: balanceData.totalExtraWorking, color: "text-violet-500" },
            { icon: "minus", value: balanceData.leavesTaken, color: "text-red-500" },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barSize={40}>
                <defs>
                  <linearGradient id="workingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="extraGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="halfDayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="leaveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="working" stackId="a" fill="url(#workingGrad)" name="Working" />
                <Bar dataKey="extraWorking" stackId="a" fill="url(#extraGrad)" name="Extra" />
                <Bar dataKey="halfDays" stackId="a" fill="url(#halfDayGrad)" name="Half Day" />
                <Bar dataKey="leaves" stackId="a" fill="url(#leaveGrad)" radius={[6, 6, 0, 0]} name="Leave" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">
              No data yet. Start tracking days in the Calendar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
