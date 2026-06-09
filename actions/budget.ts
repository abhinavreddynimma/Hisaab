"use server";

import { db } from "@/db";
import { budgetItems, expenseTransactions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertAdminAccess } from "@/lib/auth";
import type { BudgetCategory, BudgetItem } from "@/lib/types";

export async function getBudgetItems(): Promise<BudgetItem[]> {
  await assertAdminAccess();
  const rows = db
    .select()
    .from(budgetItems)
    .orderBy(budgetItems.sortOrder, budgetItems.id)
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    category: r.category as BudgetCategory,
    sortOrder: r.sortOrder,
  }));
}

export async function createBudgetItem(data: {
  name: string;
  amount: number;
  category: BudgetCategory;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const name = data.name.trim();
  if (!name || !(data.amount > 0)) return { success: false };

  const maxSort = db
    .select({ m: sql<number>`coalesce(max(${budgetItems.sortOrder}), 0)` })
    .from(budgetItems)
    .get();

  const result = db
    .insert(budgetItems)
    .values({
      name,
      amount: data.amount,
      category: data.category,
      sortOrder: (maxSort?.m ?? 0) + 1,
    })
    .run();

  revalidatePath("/budget");
  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateBudgetItem(
  id: number,
  data: { name?: string; amount?: number; category?: BudgetCategory },
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.category !== undefined) patch.category = data.category;
  if (Object.keys(patch).length === 0) return { success: true };

  db.update(budgetItems).set(patch).where(eq(budgetItems.id, id)).run();
  revalidatePath("/budget");
  return { success: true };
}

export async function deleteBudgetItem(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(budgetItems).where(eq(budgetItems.id, id)).run();
  revalidatePath("/budget");
  return { success: true };
}

/**
 * Typical monthly income derived from real receipts — confirmed, non-
 * modification income transactions (invoice payments + any manual income)
 * over the trailing 12 months, averaged across the months that actually had
 * income. This is the planning baseline the budget allocates against, so an
 * occasional zero-income month doesn't drag the figure down.
 */
export async function getBudgetMonthlyIncome(): Promise<{
  monthlyIncome: number;
  monthsCounted: number;
  windowMonths: number;
}> {
  await assertAdminAccess();

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

  const rows = db
    .select({
      month: sql<string>`substr(${expenseTransactions.date}, 1, 7)`,
      total: sql<number>`sum(${expenseTransactions.amount})`,
    })
    .from(expenseTransactions)
    .where(
      and(
        eq(expenseTransactions.type, "income"),
        eq(expenseTransactions.status, "confirmed"),
        eq(expenseTransactions.isModification, false),
        sql`${expenseTransactions.date} >= ${startStr}`,
      ),
    )
    .groupBy(sql`substr(${expenseTransactions.date}, 1, 7)`)
    .all();

  const monthsCounted = rows.length;
  const sum = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const monthlyIncome = monthsCounted > 0 ? Math.round(sum / monthsCounted) : 0;

  return { monthlyIncome, monthsCounted, windowMonths: 12 };
}
