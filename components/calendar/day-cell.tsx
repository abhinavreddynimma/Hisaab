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
        "relative flex flex-col items-center justify-start gap-1 rounded-md border border-transparent p-2 text-sm transition-colors hover:bg-accent",
        "min-h-[60px] w-full",
        !isCurrentMonth && "opacity-40",
        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        dayTypeConfig?.bgLight,
        isHoliday && "bg-green-50 dark:bg-green-950",
        isImplicitWorking && "bg-blue-50 dark:bg-blue-950"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          isToday && "font-bold text-primary",
          !isCurrentMonth && "text-muted-foreground"
        )}
      >
        {dayOfMonth}
      </span>
      {dayEntry && dayTypeConfig && (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            dayTypeConfig.color
          )}
          title={dayTypeConfig.label}
        />
      )}
      {isImplicitWorking && (
        <span
          className="h-2 w-2 rounded-full bg-blue-500"
          title="Working"
        />
      )}
      {isHoliday && (
        <span
          className="h-2 w-2 rounded-full bg-green-500"
          title={holidayName}
        />
      )}
      {holidayName && (
        <span className="text-[9px] leading-tight text-green-700 dark:text-green-400 text-center truncate w-full">
          {holidayName}
        </span>
      )}
    </button>
  );
}
