"use client";

import { useRef, useMemo } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDaysInMonth } from "@/lib/calculations";
import { getFrenchHolidays, WEEKDAYS_EU } from "@/lib/constants";
import type { DayEntry } from "@/lib/types";

interface CalendarSnapshotProps {
  year: number;
  month: number;
  entries: DayEntry[];
  onClose: () => void;
}

type SnapshotDayType = "working" | "holiday" | "weekend" | "leave" | "half_day";

const SNAPSHOT_COLORS: Record<SnapshotDayType, string> = {
  working: "#90EE90",
  holiday: "#FFD700",
  weekend: "#D3D3D3",
  leave: "#FF7F7F",
  half_day: "#87CEEB",
};

const SNAPSHOT_LABELS: Record<SnapshotDayType, string> = {
  working: "Working Day",
  holiday: "Public Holiday",
  weekend: "Weekend",
  leave: "Leave",
  half_day: "Half Day",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SnapshotDay {
  day: number;
  type: SnapshotDayType;
  holidayName?: string;
}

export function CalendarSnapshot({ year, month, entries, onClose }: CalendarSnapshotProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const { days, counts } = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const frenchHolidays = getFrenchHolidays(year);

    const entryMap = new Map<string, DayEntry>();
    for (const entry of entries) {
      entryMap.set(entry.date, entry);
    }

    const result: SnapshotDay[] = [];
    const countMap: Record<SnapshotDayType, number> = {
      working: 0,
      holiday: 0,
      weekend: 0,
      leave: 0,
      half_day: 0,
    };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(year, month - 1, day);
      const dow = dateObj.getDay();
      const isWeekendDay = dow === 0 || dow === 6;
      const entry = entryMap.get(dateStr);
      const holidayName = frenchHolidays.get(dateStr);

      let type: SnapshotDayType;

      if (entry) {
        switch (entry.dayType) {
          case "leave":
            type = "leave";
            break;
          case "half_day":
            type = "half_day";
            break;
          case "holiday":
            type = "holiday";
            break;
          case "weekend":
            // Check if it's a holiday on a weekend
            type = holidayName ? "holiday" : "weekend";
            break;
          case "extra_working":
            // Client-facing: extra working appears as regular working
            type = "working";
            break;
          case "working":
          default:
            // Check if this date is a French holiday not yet marked
            type = holidayName ? "holiday" : "working";
            break;
        }
      } else {
        // No entry - determine from day of week and holidays
        if (holidayName && !isWeekendDay) {
          type = "holiday";
        } else if (isWeekendDay) {
          type = holidayName ? "holiday" : "weekend";
        } else {
          type = "working";
        }
      }

      countMap[type]++;
      result.push({ day, type, holidayName: holidayName || undefined });
    }

    return { days: result, counts: countMap };
  }, [year, month, entries]);

  // Build grid: Mon-Sun layout
  // Find what day of week day 1 falls on (0=Sun ... 6=Sat)
  const firstDow = new Date(year, month - 1, 1).getDay();
  // Convert to Mon=0...Sun=6
  const firstDowEu = firstDow === 0 ? 6 : firstDow - 1;

  // Build grid rows
  const gridCells: (SnapshotDay | null)[] = [];
  for (let i = 0; i < firstDowEu; i++) {
    gridCells.push(null);
  }
  for (const day of days) {
    gridCells.push(day);
  }
  // Pad to complete the last row
  while (gridCells.length % 7 !== 0) {
    gridCells.push(null);
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Calendar - ${MONTH_NAMES[month - 1]} ${year}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  const usedTypes = (Object.keys(counts) as SnapshotDayType[]).filter(
    (t) => counts[t] > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Calendar Snapshot - {MONTH_NAMES[month - 1]} {year}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={printRef} className="p-6">
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#111" }}>
            <h1 style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
              {MONTH_NAMES[month - 1]} {year}
            </h1>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  {WEEKDAYS_EU.map((day) => (
                    <th
                      key={day}
                      style={{
                        padding: "8px 4px",
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderBottom: "2px solid #333",
                        color: "#333",
                      }}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: gridCells.length / 7 }, (_, rowIdx) => (
                  <tr key={rowIdx}>
                    {gridCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => (
                      <td
                        key={colIdx}
                        style={{
                          padding: "4px",
                          verticalAlign: "top",
                          height: "56px",
                          border: "1px solid #ddd",
                        }}
                      >
                        {cell && (
                          <div
                            style={{
                              backgroundColor: SNAPSHOT_COLORS[cell.type],
                              borderRadius: "4px",
                              padding: "4px 6px",
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111" }}>
                              {cell.day}
                            </span>
                            {cell.holidayName && (
                              <span style={{ fontSize: "8px", color: "#555", textAlign: "center", lineHeight: "1.1" }}>
                                {cell.holidayName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                marginTop: "16px",
                justifyContent: "center",
                fontSize: "13px",
              }}
            >
              {usedTypes.map((type) => (
                <div
                  key={type}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "3px",
                      backgroundColor: SNAPSHOT_COLORS[type],
                      border: "1px solid #999",
                    }}
                  />
                  <span style={{ color: "#333" }}>
                    {SNAPSHOT_LABELS[type]}: {counts[type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
