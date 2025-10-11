"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DayEntry } from "@/lib/types";

interface CalendarOverviewProps {
  entries: DayEntry[];
  holidays: [string, string][];
  months?: number;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const DAY_STYLES: Record<string, { bg: string; text: string }> = {
  working: {
    bg: "bg-slate-100/70",
    text: "text-slate-600",
  },
  implicit_working: {
    bg: "bg-slate-50/80",
    text: "text-slate-500",
  },
  leave: {
    bg: "bg-rose-50 ring-1 ring-rose-200/60",
    text: "text-rose-500 font-medium",
  },
  holiday: {
    bg: "bg-teal-50 ring-1 ring-teal-200/60",
    text: "text-teal-600 font-medium",
  },
  half_day: {
    bg: "bg-orange-50 ring-1 ring-orange-200/60",
    text: "text-orange-500 font-medium",
  },
  extra_working: {
    bg: "bg-violet-50 ring-1 ring-violet-200/60",
    text: "text-violet-500 font-medium",
  },
  weekend: {
    bg: "",
    text: "text-gray-300",
  },
  none: {
    bg: "",
    text: "text-gray-400",
  },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function MiniMonth({
  year,
  month,
  entryMap,
  holidayMap,
}: {
  year: number;
  month: number;
  entryMap: Map<string, DayEntry>;
  holidayMap: Map<string, string>;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: { day: number; dateStr: string; type: string }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const entry = entryMap.get(dateStr);
    const isHoliday = holidayMap.has(dateStr);
    const dateObj = new Date(year, month - 1, d);
    const dow = dateObj.getDay();
    const isWeekend = dow === 0 || dow === 6;

    let type = "none";
    if (entry) {
      type = entry.dayType;
    } else if (isHoliday) {
      type = "holiday";
    } else if (isWeekend) {
      type = "weekend";
    } else {
      type = "implicit_working";
    }

    cells.push({ day: d, dateStr, type });
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="mb-3 text-sm font-semibold text-gray-800">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="flex items-center justify-center text-xs font-medium text-gray-400 pb-1">
            {w}
          </div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {cells.map((c) => {
          const isToday = c.dateStr === todayStr;
          const style = DAY_STYLES[c.type] ?? DAY_STYLES.none;

          return (
            <div
              key={c.day}
              className={cn(
                "flex items-center justify-center h-9 w-9 mx-auto rounded-full text-sm transition-all",
                style.bg,
                style.text,
                isToday && "ring-2 ring-offset-1 ring-gray-900 font-bold",
              )}
              title={
                c.type === "holiday"
                  ? holidayMap.get(c.dateStr)
                  : c.type === "implicit_working"
                  ? "Working"
                  : c.type === "weekend"
                  ? "Weekend"
                  : c.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
              }
            >
              {c.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LEGEND = [
  { label: "Working", color: "bg-slate-200" },
  { label: "Leave", color: "bg-rose-200" },
  { label: "Holiday", color: "bg-teal-200" },
  { label: "Half Day", color: "bg-orange-200" },
  { label: "Extra", color: "bg-violet-200" },
];

export function CalendarOverview({ entries, holidays }: CalendarOverviewProps) {
  const [offset, setOffset] = useState(0);

  const entryMap = new Map<string, DayEntry>();
  for (const e of entries) entryMap.set(e.date, e);
  const holidayMap = new Map<string, string>(holidays);

  const now = new Date();
  const monthList: { year: number; month: number }[] = [];
  // 3 months back + offset, current + offset, 1 month ahead + offset
  for (let i = -3; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + offset, 1);
    monthList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle>Calendar</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {offset !== 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOffset(0)}>
              Today
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-6">
          {monthList.map(({ year, month }) => (
            <MiniMonth
              key={`${year}-${month}`}
              year={year}
              month={month}
              entryMap={entryMap}
              holidayMap={holidayMap}
            />
          ))}
        </div>
        <div className="flex items-center gap-5 mt-4 pt-3 border-t">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
              <span className={cn("inline-block h-3 w-3 rounded-full shadow-sm", item.color)} />
              {item.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
