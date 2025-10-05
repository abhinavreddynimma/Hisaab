"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MonthCalendar } from "./month-calendar";
import { CalendarSnapshot } from "./calendar-snapshot";
import { clearAllDayEntries } from "@/actions/day-entries";
import type { DayEntry } from "@/lib/types";

interface CalendarPageClientProps {
  year: number;
  month: number;
  entries: DayEntry[];
  projects: { id: number; name: string; clientName: string }[];
  leaveBalance: number;
  defaultProjectId: number | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarPageClient({
  year,
  month,
  entries,
  projects,
  leaveBalance,
  defaultProjectId,
}: CalendarPageClientProps) {
  const router = useRouter();
  const [showSnapshot, setShowSnapshot] = useState(false);

  function navigateMonth(direction: -1 | 1) {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    router.push(`/calendar?year=${newYear}&month=${newMonth}`);
  }

  function goToToday() {
    const now = new Date();
    router.push(`/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Calendar Entries</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all day entries across all months.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    const result = await clearAllDayEntries();
                    if (result.success) {
                      toast.success(`Cleared ${result.count} entries`);
                      router.refresh();
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={() => setShowSnapshot(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MonthCalendar
        year={year}
        month={month}
        entries={entries}
        projects={projects}
        leaveBalance={leaveBalance}
        defaultProjectId={defaultProjectId}
      />

      {showSnapshot && (
        <CalendarSnapshot
          year={year}
          month={month}
          entries={entries}
          onClose={() => setShowSnapshot(false)}
        />
      )}
    </div>
  );
}
