"use server";

import { db } from "@/db";
import { dayEntries } from "@/db/schema";
import { eq, and, gte, lte, like, isNull } from "drizzle-orm";
import type { DayEntry } from "@/lib/types";
import type { DayType } from "@/lib/constants";

export async function getDayEntriesForMonth(
  year: number,
  month: number
): Promise<DayEntry[]> {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return db
    .select()
    .from(dayEntries)
    .where(like(dayEntries.date, `${monthKey}%`))
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function getDayEntry(date: string): Promise<DayEntry | null> {
  const entry = db
    .select()
    .from(dayEntries)
    .where(eq(dayEntries.date, date))
    .get();
  return (entry as DayEntry) ?? null;
}

export async function upsertDayEntry(data: {
  date: string;
  dayType: DayType;
  projectId?: number | null;
  notes?: string;
}): Promise<{ success: boolean }> {
  const existing = db
    .select()
    .from(dayEntries)
    .where(eq(dayEntries.date, data.date))
    .get();

  if (existing) {
    db.update(dayEntries)
      .set({
        dayType: data.dayType,
        projectId: data.projectId ?? null,
        notes: data.notes || null,
      })
      .where(eq(dayEntries.date, data.date))
      .run();
  } else {
    db.insert(dayEntries)
      .values({
        date: data.date,
        dayType: data.dayType,
        projectId: data.projectId ?? null,
        notes: data.notes || null,
      })
      .run();
  }

  return { success: true };
}

export async function deleteDayEntry(date: string): Promise<{ success: boolean }> {
  db.delete(dayEntries).where(eq(dayEntries.date, date)).run();
  return { success: true };
}

export async function getDayEntriesForRange(
  startDate: string,
  endDate: string
): Promise<DayEntry[]> {
  return db
    .select()
    .from(dayEntries)
    .where(and(gte(dayEntries.date, startDate), lte(dayEntries.date, endDate)))
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function getAllDayEntries(): Promise<DayEntry[]> {
  return db
    .select()
    .from(dayEntries)
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function clearAllDayEntries(): Promise<{ success: boolean; count: number }> {
  const all = db.select().from(dayEntries).all();
  const count = all.length;
  db.delete(dayEntries).run();
  return { success: true, count };
}

export async function bulkUpsertDayEntries(
  entries: { date: string; dayType: DayType; projectId?: number | null; notes?: string }[]
): Promise<{ success: boolean; count: number }> {
  let count = 0;
  for (const entry of entries) {
    await upsertDayEntry(entry);
    count++;
  }
  return { success: true, count };
}

export async function backfillProjectId(projectId: number): Promise<{ success: boolean; count: number }> {
  const result = db
    .update(dayEntries)
    .set({ projectId })
    .where(isNull(dayEntries.projectId))
    .run();
  return { success: true, count: result.changes };
}
