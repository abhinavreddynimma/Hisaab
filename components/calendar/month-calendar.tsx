"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAYS, getFrenchHolidays } from "@/lib/constants";
import { getCalendarDays, calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import type { DayEntry } from "@/lib/types";
import { DayCell } from "./day-cell";
import { DayEntryDialog } from "./day-entry-dialog";
import { MonthSummaryCard } from "./month-summary";

interface MonthCalendarProps {
  year: number;
  month: number;
  entries: DayEntry[];
  projects: { id: number; name: string; clientName: string }[];
  leaveBalance: number;
  defaultProjectId: number | null;
}

export function MonthCalendar({
  year,
  month,
  entries,
  projects,
  leaveBalance,
  defaultProjectId,
}: MonthCalendarProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const calendarDays = useMemo(
    () => getCalendarDays(year, month),
    [year, month]
  );

  const holidays = useMemo(
    () => getFrenchHolidays(year),
    [year]
  );

  const entryMap = useMemo(() => {
    const map = new Map<string, DayEntry>();
    for (const entry of entries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [entries]);

  const effectiveEntries = useMemo(
    () => withImplicitWorkingDays(entries, year, month, holidays),
    [entries, holidays, year, month]
  );

  const summary = useMemo(
    () => calculateMonthSummary(effectiveEntries),
    [effectiveEntries]
  );

  const selectedEntry = selectedDate ? entryMap.get(selectedDate) ?? null : null;

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setDialogOpen(true);
  }

  function handleSave() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((day) => (
          <DayCell
            key={day.date}
            date={day.date}
            dayOfMonth={day.dayOfMonth}
            isCurrentMonth={day.isCurrentMonth}
            dayEntry={entryMap.get(day.date) ?? null}
            holidayName={holidays.get(day.date) ?? null}
            onClick={handleDayClick}
          />
        ))}
      </div>

      <MonthSummaryCard summary={summary} leaveBalance={leaveBalance} />

      <DayEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={selectedDate}
        entry={selectedEntry}
        projects={projects}
        defaultProjectId={defaultProjectId}
        onSave={handleSave}
      />
    </div>
  );
}
