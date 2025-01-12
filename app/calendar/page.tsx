import { getDayEntriesForMonth, getAllDayEntries } from "@/actions/day-entries";
import { getActiveProjects } from "@/actions/projects";
import { getLeavePolicy, getDefaultProjectId } from "@/actions/settings";
import { calculateLeaveBalance } from "@/lib/calculations";
import { CalendarPageClient } from "@/components/calendar/calendar-page-client";

interface CalendarPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [entries, activeProjects, leavePolicy, allEntries, defaultProjectId] = await Promise.all([
    getDayEntriesForMonth(year, month),
    getActiveProjects(),
    getLeavePolicy(),
    getAllDayEntries(),
    getDefaultProjectId(),
  ]);

  const projects = activeProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.clientName,
  }));

  const leaveBalance = calculateLeaveBalance(leavePolicy, allEntries, year, month);

  return (
    <CalendarPageClient
      year={year}
      month={month}
      entries={entries}
      projects={projects}
      leaveBalance={leaveBalance}
      defaultProjectId={defaultProjectId}
    />
  );
}
