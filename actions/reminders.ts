"use server";

import { db } from "@/db";
import { reminders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { assertAdminAccess } from "@/lib/auth";

export async function getActiveReminders(): Promise<
  { id: number; type: string; monthKey: string }[]
> {
  await assertAdminAccess();

  const now = new Date();
  if (now.getDate() < 2) return [];

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Lazy-create the accountant_documents reminder for this month
  const existing = db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.type, "accountant_documents"),
        eq(reminders.monthKey, monthKey),
      ),
    )
    .get();

  if (!existing) {
    db.insert(reminders)
      .values({ type: "accountant_documents", monthKey })
      .run();
  }

  return db
    .select({ id: reminders.id, type: reminders.type, monthKey: reminders.monthKey })
    .from(reminders)
    .where(
      and(
        eq(reminders.monthKey, monthKey),
        eq(reminders.status, "pending"),
      ),
    )
    .all();
}

export async function dismissReminder(id: number): Promise<void> {
  await assertAdminAccess();
  db.update(reminders)
    .set({ status: "dismissed", dismissedAt: new Date().toISOString() })
    .where(eq(reminders.id, id))
    .run();
}
