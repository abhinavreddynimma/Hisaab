"use client";

import { cn } from "@/lib/utils";
import { DAY_TYPES } from "@/lib/constants";
import type { DayEntry } from "@/lib/types";

interface DayCellProps {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  dayEntry: DayEntry | null;
  holidayName: string | null;
  onClick: (date: string) => void;
}

export function DayCell({
  date,
  dayOfMonth,
  isCurrentMonth,
  dayEntry,
  holidayName,
  onClick,
}: DayCellProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isToday = date === todayStr;

  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Implicit working day: weekday with no entry and no holiday
  const isImplicitWorking = !dayEntry && !holidayName && !isWeekend && isCurrentMonth;

  const dayTypeConfig = dayEntry ? DAY_TYPES[dayEntry.dayType] : null;
  const isHoliday = !!holidayName && !dayEntry;

  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      className={cn(
        "relative flex flex-col items-center justify-start gap-1.5 rounded-lg border p-2.5 text-sm",
        "min-h-[80px] w-full",
        "transition-all duration-150 hover:scale-[1.02] hover:shadow-md hover:shadow-black/[0.08]",
        !isCurrentMonth && "opacity-50",
        isToday && "bg-primary/5 ring-1 ring-primary/20 ring-offset-1 ring-offset-background",
        dayTypeConfig?.bgLight,
        dayEntry?.dayType === "leave" && "border-red-200/40 dark:border-red-800/40",
        dayEntry?.dayType === "working" && "border-blue-200/40 dark:border-blue-800/40",
        dayEntry?.dayType === "half_day" && "border-sky-200/40 dark:border-sky-800/40",
        dayEntry?.dayType === "extra_working" && "border-purple-200/40 dark:border-purple-800/40",
        dayEntry?.dayType === "holiday" && "border-green-200/40 dark:border-green-800/40",
        isHoliday && "bg-green-50 dark:bg-green-950 border-green-200/40 dark:border-green-800/40",
        isImplicitWorking && "bg-blue-50 dark:bg-blue-950 border-blue-200/40 dark:border-blue-800/40",
        !dayTypeConfig && !isHoliday && !isImplicitWorking && "border-border/40"
      )}
    >
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          isToday && "font-bold text-primary",
          !isCurrentMonth && "text-muted-foreground"
        )}
      >
        {dayOfMonth}
      </span>
      {dayEntry && dayTypeConfig && (
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full shadow-sm",
            dayTypeConfig.color
          )}
          title={dayTypeConfig.label}
        />
      )}
      {isImplicitWorking && (
        <span
          className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm"
          title="Working"
        />
      )}
      {isHoliday && (
        <span
          className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm"
          title={holidayName}
        />
      )}
      {holidayName && (
        <span className="text-[9px] leading-tight text-green-700 dark:text-green-400 text-center truncate w-full font-medium">
          {holidayName}
        </span>
      )}
    </button>
  );
}
