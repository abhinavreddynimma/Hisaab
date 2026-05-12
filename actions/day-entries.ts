"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dayEntries } from "@/db/schema";
import { eq, and, gte, lte, like, isNull } from "drizzle-orm";
import type { DayEntry } from "@/lib/types";
import type { DayType } from "@/lib/constants";
import { assertAdminAccess } from "@/lib/auth";

function revalidateDayEntrySurfaces() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/tax");
  revalidatePath("/extra-days");
}

export async function getDayEntriesForMonth(
  year: number,
  month: number
): Promise<DayEntry[]> {
  await assertAdminAccess();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return db
    .select()
    .from(dayEntries)
    .where(like(dayEntries.date, `${monthKey}%`))
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function getDayEntry(date: string): Promise<DayEntry | null> {
  await assertAdminAccess();
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
  await assertAdminAccess();
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

  revalidateDayEntrySurfaces();
  return { success: true };
}

export async function deleteDayEntry(date: string): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(dayEntries).where(eq(dayEntries.date, date)).run();
  revalidateDayEntrySurfaces();
  return { success: true };
}

export async function getDayEntriesForRange(
  startDate: string,
  endDate: string
): Promise<DayEntry[]> {
  await assertAdminAccess();
  return db
    .select()
    .from(dayEntries)
    .where(and(gte(dayEntries.date, startDate), lte(dayEntries.date, endDate)))
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function getAllDayEntries(): Promise<DayEntry[]> {
  await assertAdminAccess();
  return db
    .select()
    .from(dayEntries)
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

export async function clearAllDayEntries(): Promise<{ success: boolean; count: number }> {
  await assertAdminAccess();
  const all = db.select().from(dayEntries).all();
  const count = all.length;
  db.delete(dayEntries).run();
  return { success: true, count };
}

export async function bulkUpsertDayEntries(
  entries: { date: string; dayType: DayType; projectId?: number | null; notes?: string }[]
): Promise<{ success: boolean; count: number }> {
  await assertAdminAccess();
  if (entries.length === 0) return { success: true, count: 0 };

  // Wrap in a single transaction so N entries = 1 commit instead of N. Each
  // row uses an upsert (insert or update on conflict on the unique date).
  db.transaction((tx) => {
    for (const entry of entries) {
      const existing = tx
        .select()
        .from(dayEntries)
        .where(eq(dayEntries.date, entry.date))
        .get();
      if (existing) {
        tx.update(dayEntries)
          .set({
            dayType: entry.dayType,
            projectId: entry.projectId ?? null,
            notes: entry.notes || null,
          })
          .where(eq(dayEntries.date, entry.date))
          .run();
      } else {
        tx.insert(dayEntries)
          .values({
            date: entry.date,
            dayType: entry.dayType,
            projectId: entry.projectId ?? null,
            notes: entry.notes || null,
          })
          .run();
      }
    }
  });
  revalidateDayEntrySurfaces();
  return { success: true, count: entries.length };
}

export async function backfillProjectId(projectId: number): Promise<{ success: boolean; count: number }> {
  await assertAdminAccess();
  const result = db
    .update(dayEntries)
    .set({ projectId })
    .where(isNull(dayEntries.projectId))
    .run();
  return { success: true, count: result.changes };
}
