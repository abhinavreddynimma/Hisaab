"use server";

import { db } from "@/db";
import { expenseRecurring, expenseRecurringSkips, expenseTransactions, expenseAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { assertAdminAccess } from "@/lib/auth";
import type { ExpenseRecurring, RecurringFrequency, ExpenseTransactionType } from "@/lib/types";
import { revalidatePath } from "next/cache";

function parseRecurringSourceKey(sourceId: string | null): { recurringId: number; monthKey: string } | null {
  if (!sourceId) return null;
  const match = /^(\d+):(\d{4}-\d{2})$/.exec(sourceId);
  if (!match) return null;
  return {
    recurringId: Number(match[1]),
    monthKey: match[2],
  };
}

// ============================================================
// CRUD
// ============================================================

export async function getRecurringExpenses(): Promise<ExpenseRecurring[]> {
  await assertAdminAccess();

  const items = db
    .select()
    .from(expenseRecurring)
    .orderBy(expenseRecurring.name)
    .all() as ExpenseRecurring[];

  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map((a) => [a.id, a.name]));

  return items.map((item) => ({
    ...item,
    categoryName: item.categoryId ? accountMap.get(item.categoryId) ?? undefined : undefined,
    accountName: item.accountId ? accountMap.get(item.accountId) ?? undefined : undefined,
  }));
}

export async function createRecurringExpense(data: {
  name: string;
  type: ExpenseTransactionType;
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  startDate: string;
  endDate?: string | null;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();

  const result = db
    .insert(expenseRecurring)
    .values({
      name: data.name,
      type: data.type === "income" ? "expense" : data.type, // recurring is for expenses/transfers only
      amount: data.amount,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId ?? null,
      fromAccountId: data.fromAccountId ?? null,
      toAccountId: data.toAccountId ?? null,
      frequency: data.frequency,
      dayOfMonth: Math.min(28, Math.max(1, data.dayOfMonth)),
      startDate: data.startDate,
      endDate: data.endDate ?? null,
    })
    .run();

  revalidatePath("/expenses");
  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateRecurringExpense(
  id: number,
  data: {
    name: string;
    type: ExpenseTransactionType;
    amount: number;
    categoryId?: number | null;
    accountId?: number | null;
    fromAccountId?: number | null;
    toAccountId?: number | null;
    frequency: RecurringFrequency;
    dayOfMonth: number;
    endDate?: string | null;
  },
): Promise<{ success: boolean }> {
  await assertAdminAccess();

  db.update(expenseRecurring)
    .set({
      name: data.name,
      type: data.type === "income" ? "expense" : data.type,
      amount: data.amount,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId ?? null,
      fromAccountId: data.fromAccountId ?? null,
      toAccountId: data.toAccountId ?? null,
      frequency: data.frequency,
      dayOfMonth: Math.min(28, Math.max(1, data.dayOfMonth)),
      endDate: data.endDate ?? null,
    })
    .where(eq(expenseRecurring.id, id))
    .run();

  revalidatePath("/expenses");
  return { success: true };
}

export async function deleteRecurringExpense(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();

  // Remove any future estimated transactions linked to this recurring rule
  db.delete(expenseTransactions)
    .where(
      and(
        eq(expenseTransactions.source, "recurring"),
        sql`${expenseTransactions.sourceId} like ${`${id}:%`}`,
        eq(expenseTransactions.status, "estimated"),
      ),
    )
    .run();

  db.delete(expenseRecurringSkips)
    .where(eq(expenseRecurringSkips.recurringId, id))
    .run();

  db.delete(expenseRecurring).where(eq(expenseRecurring.id, id)).run();

  revalidatePath("/expenses");
  return { success: true };
}

export async function toggleRecurringActive(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();

  const item = db.select().from(expenseRecurring).where(eq(expenseRecurring.id, id)).get();
  if (!item) return { success: false };

  db.update(expenseRecurring)
    .set({ isActive: !item.isActive })
    .where(eq(expenseRecurring.id, id))
    .run();

  // If deactivating, remove future estimated transactions
  if (item.isActive) {
    const today = new Date().toISOString().split("T")[0];
    db.delete(expenseTransactions)
      .where(
        and(
          eq(expenseTransactions.source, "recurring"),
          sql`${expenseTransactions.sourceId} like ${`${id}:%`}`,
          eq(expenseTransactions.status, "estimated"),
          sql`${expenseTransactions.date} >= ${today}`,
        ),
      )
      .run();
  }

  revalidatePath("/expenses");
  return { success: true };
}

// ============================================================
// SYNC — generate estimated transactions for a given month
// ============================================================

/** Check if a recurring rule should fire in a given month. */
function shouldFireInMonth(
  rule: { frequency: string; startDate: string; endDate: string | null },
  year: number,
  month: number,
): boolean {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Check date range
  if (rule.startDate > monthEnd) return false;
  if (rule.endDate && rule.endDate < monthStart) return false;

  if (rule.frequency === "monthly") return true;

  if (rule.frequency === "quarterly") {
    const startMonth = parseInt(rule.startDate.split("-")[1]);
    const diff = (month - startMonth + 12) % 12;
    return diff % 3 === 0;
  }

  if (rule.frequency === "yearly") {
    const startMonth = parseInt(rule.startDate.split("-")[1]);
    return month === startMonth;
  }

  return false;
}

/**
 * Sync recurring expenses for a given month.
 * Creates estimated transactions that don't already exist.
 * Idempotent — safe to call on every page load.
 */
export async function syncRecurringForMonth(year: number, month: number): Promise<{ created: number }> {
  const rules = db
    .select()
    .from(expenseRecurring)
    .where(eq(expenseRecurring.isActive, true))
    .all();

  // Get all existing recurring transactions for this month
  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const existingTxns = db
    .select({ sourceId: expenseTransactions.sourceId })
    .from(expenseTransactions)
    .where(
      and(
        eq(expenseTransactions.source, "recurring"),
        sql`${expenseTransactions.date} >= ${monthStart}`,
        sql`${expenseTransactions.date} <= ${monthEnd}`,
      ),
    )
    .all();

  const existingSourceIds = new Set(existingTxns.map((t) => t.sourceId));
  const skippedMonths = db
    .select({
      recurringId: expenseRecurringSkips.recurringId,
      monthKey: expenseRecurringSkips.monthKey,
    })
    .from(expenseRecurringSkips)
    .where(eq(expenseRecurringSkips.monthKey, `${year}-${String(month).padStart(2, "0")}`))
    .all();
  const skippedSourceIds = new Set(
    skippedMonths.map((item) => `${item.recurringId}:${item.monthKey}`)
  );

  let created = 0;
  for (const rule of rules) {
    if (!shouldFireInMonth(rule, year, month)) continue;

    // sourceId format: "recurringId:YYYY-MM" to allow one per rule per month
    const sourceKey = `${rule.id}:${year}-${String(month).padStart(2, "0")}`;
    if (existingSourceIds.has(sourceKey) || skippedSourceIds.has(sourceKey)) continue;

    const day = Math.min(rule.dayOfMonth, lastDay);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    db.insert(expenseTransactions)
      .values({
        type: rule.type as "expense" | "transfer",
        date,
        amount: rule.amount,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        fromAccountId: rule.fromAccountId,
        toAccountId: rule.toAccountId,
        note: rule.name,
        source: "recurring",
        sourceId: sourceKey,
        status: "estimated",
      })
      .run();

    created++;
  }

  return { created };
}

/**
 * Confirm an estimated recurring transaction (mark it as actual).
 * Optionally adjust the amount if the real expense differed.
 */
export async function confirmRecurringTransaction(
  transactionId: number,
  actualAmount?: number,
): Promise<{ success: boolean }> {
  await assertAdminAccess();

  const txn = db
    .select()
    .from(expenseTransactions)
    .where(eq(expenseTransactions.id, transactionId))
    .get();

  if (!txn || txn.source !== "recurring" || txn.status !== "estimated") {
    return { success: false };
  }

  const updateData: Record<string, unknown> = { status: "confirmed" };
  if (actualAmount !== undefined) {
    updateData.amount = actualAmount;
  }

  db.update(expenseTransactions)
    .set(updateData)
    .where(eq(expenseTransactions.id, transactionId))
    .run();

  revalidatePath("/expenses");
  return { success: true };
}

export async function skipRecurringTransactionForMonth(transactionId: number): Promise<{ success: boolean }> {
  await assertAdminAccess();

  const txn = db
    .select()
    .from(expenseTransactions)
    .where(eq(expenseTransactions.id, transactionId))
    .get();

  if (!txn || txn.source !== "recurring") {
    return { success: false };
  }

  const parsed = parseRecurringSourceKey(txn.sourceId);
  if (!parsed) {
    return { success: false };
  }

  db.insert(expenseRecurringSkips)
    .values({
      recurringId: parsed.recurringId,
      monthKey: parsed.monthKey,
    })
    .onConflictDoNothing()
    .run();

  db.delete(expenseTransactions)
    .where(eq(expenseTransactions.id, transactionId))
    .run();

  revalidatePath("/expenses");
  return { success: true };
}
