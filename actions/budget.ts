"use server";

import { db } from "@/db";
import { budgetItems, invoices } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertAdminAccess } from "@/lib/auth";
import { getCurrentFinancialYear, getFYDateRange } from "@/lib/constants";
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
 * Monthly income baseline = the average net INR across paid invoices in the
 * CURRENT financial year, so it tracks current salary rather than being
 * dragged down by older, lower invoices. Scoped by paid_date (when the money
 * actually landed). Uses net_inr_amount (post platform / bank charges).
 */
export async function getBudgetMonthlyIncome(): Promise<{
  monthlyIncome: number;
  invoiceCount: number;
  financialYear: string;
}> {
  await assertAdminAccess();

  const financialYear = getCurrentFinancialYear();
  const { start, end } = getFYDateRange(financialYear);

  const rows = db
    .select({ net: invoices.netInrAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.netInrAmount} IS NOT NULL`,
        sql`${invoices.paidDate} >= ${start}`,
        sql`${invoices.paidDate} <= ${end}`,
      ),
    )
    .all();

  const invoiceCount = rows.length;
  const sum = rows.reduce((s, r) => s + (r.net ?? 0), 0);
  const monthlyIncome = invoiceCount > 0 ? Math.round(sum / invoiceCount) : 0;

  return { monthlyIncome, invoiceCount, financialYear };
}
