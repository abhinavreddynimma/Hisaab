import type { MonthSummary, DayEntry, LeavePolicy } from "./types";

export function calculateMonthSummary(entries: DayEntry[]): MonthSummary {
  const summary: MonthSummary = {
    workingDays: 0,
    leaves: 0,
    holidays: 0,
    halfDays: 0,
    extraWorkingDays: 0,
    weekends: 0,
    effectiveWorkingDays: 0,
  };

  for (const entry of entries) {
    switch (entry.dayType) {
      case "working":
        summary.workingDays++;
        break;
      case "leave":
        summary.leaves++;
        break;
      case "holiday":
        summary.holidays++;
        break;
      case "half_day":
        summary.halfDays++;
        break;
      case "extra_working":
        summary.extraWorkingDays++;
        break;
      case "weekend":
        summary.weekends++;
        break;
    }
  }

  summary.effectiveWorkingDays =
    summary.workingDays + summary.extraWorkingDays + summary.halfDays * 0.5;

  return summary;
}

export function calculateLeaveBalance(
  policy: LeavePolicy,
  allEntries: DayEntry[],
  upToYear?: number,
  upToMonth?: number,
): number {
  const [startYear, startMonth] = policy.trackingStartDate.split("-").map(Number);

  let targetYear: number;
  let targetMonth: number;
  if (upToYear !== undefined && upToMonth !== undefined) {
    targetYear = upToYear;
    targetMonth = upToMonth;
  } else {
    const now = new Date();
    targetYear = now.getFullYear();
    targetMonth = now.getMonth() + 1;
  }

  // Count months from start to target (inclusive)
  let months = 0;
  let year = startYear;
  let month = startMonth;
  while (year < targetYear || (year === targetYear && month <= targetMonth)) {
    months++;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  // Filter entries up to end of target month
  const cutoff = `${targetYear}-${String(targetMonth).padStart(2, "0")}-31`;
  const filteredEntries = allEntries.filter((e) => e.date <= cutoff);

  const leavesGained = months * policy.leavesPerMonth;
  const leavesTaken = filteredEntries.filter((e) => e.dayType === "leave").length;
  const halfDaysTaken = filteredEntries.filter((e) => e.dayType === "half_day").length;

  return leavesGained - leavesTaken - halfDaysTaken * 0.5;
}

/**
 * Augments actual DB entries with implicit "working" entries for weekdays
 * that have no explicit entry and are not holidays.
 */
export function withImplicitWorkingDays(
  entries: DayEntry[],
  year: number,
  month: number,
  holidays: Map<string, string>,
): DayEntry[] {
  const entryDates = new Set(entries.map((e) => e.date));
  const daysInMonth = getDaysInMonth(year, month);
  const augmented: DayEntry[] = [...entries];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (entryDates.has(dateStr)) continue;
    if (holidays.has(dateStr)) continue;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    augmented.push({
      id: -day,
      date: dateStr,
      dayType: "working",
      projectId: null,
      notes: null,
    });
  }

  return augmented;
}

export function calculateMonthEarnings(
  entries: DayEntry[],
  dailyRate: number
): number {
  const summary = calculateMonthSummary(entries);
  return summary.effectiveWorkingDays * dailyRate;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = getDaysInMonth(year, month);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const days: { date: string; dayOfMonth: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    days.push({
      date: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dayOfMonth: day,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dayOfMonth: day,
      isCurrentMonth: true,
    });
  }

  // Next month padding (fill to 42 = 6 rows)
  const remaining = 42 - days.length;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let day = 1; day <= remaining; day++) {
    days.push({
      date: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dayOfMonth: day,
      isCurrentMonth: false,
    });
  }

  return days;
}
