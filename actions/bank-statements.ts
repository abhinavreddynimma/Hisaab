"use server";

import { db } from "@/db";
import { bankStatementEntries, expenseTransactions, expenseAccounts } from "@/db/schema";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { BankStatementEntry, ExpenseTransactionType } from "@/lib/types";

export async function getBankStatementEntries(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<BankStatementEntry[]> {
  const conditions = [eq(bankStatementEntries.isDismissed, false)];
  if (filters?.startDate) conditions.push(gte(bankStatementEntries.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(bankStatementEntries.date, filters.endDate));

  const rows = await db
    .select({
      id: bankStatementEntries.id,
      date: bankStatementEntries.date,
      description: bankStatementEntries.description,
      refNo: bankStatementEntries.refNo,
      debit: bankStatementEntries.debit,
      credit: bankStatementEntries.credit,
      balance: bankStatementEntries.balance,
      accountNumber: bankStatementEntries.accountNumber,
      bankName: bankStatementEntries.bankName,
      expenseName: bankStatementEntries.expenseName,
      expenseType: bankStatementEntries.expenseType,
      categoryId: bankStatementEntries.categoryId,
      accountId: bankStatementEntries.accountId,
      fromAccountId: bankStatementEntries.fromAccountId,
      toAccountId: bankStatementEntries.toAccountId,
      note: bankStatementEntries.note,
      tags: bankStatementEntries.tags,
      isClassified: bankStatementEntries.isClassified,
      isDismissed: bankStatementEntries.isDismissed,
      expenseTransactionId: bankStatementEntries.expenseTransactionId,
      createdAt: bankStatementEntries.createdAt,
    })
    .from(bankStatementEntries)
    .where(and(...conditions))
    .orderBy(bankStatementEntries.date);

  return rows as BankStatementEntry[];
}

export async function getBankStatementEntriesWithNames(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<BankStatementEntry[]> {
  const entries = await getBankStatementEntries(filters);
  if (entries.length === 0) return [];

  const accounts = await db.select().from(expenseAccounts);
  const accountMap = new Map(accounts.map(a => [a.id, a.name]));

  return entries.map(e => ({
    ...e,
    categoryName: e.categoryId ? accountMap.get(e.categoryId) : undefined,
    accountName: e.accountId ? accountMap.get(e.accountId) : undefined,
    fromAccountName: e.fromAccountId ? accountMap.get(e.fromAccountId) : undefined,
    toAccountName: e.toAccountId ? accountMap.get(e.toAccountId) : undefined,
  }));
}

export async function classifyBankStatementEntry(
  id: number,
  data: {
    expenseName: string;
    expenseType: ExpenseTransactionType;
    categoryId?: number | null;
    accountId?: number | null;
    fromAccountId?: number | null;
    toAccountId?: number | null;
    note?: string | null;
    tags?: string[] | null;
  }
) {
  // Get the entry first
  const [entry] = await db
    .select()
    .from(bankStatementEntries)
    .where(eq(bankStatementEntries.id, id));

  if (!entry) throw new Error("Entry not found");

  const amount = entry.debit || entry.credit || 0;

  // Create expense transaction
  const [txn] = await db
    .insert(expenseTransactions)
    .values({
      type: data.expenseType,
      date: entry.date,
      amount,
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      fromAccountId: data.fromAccountId || null,
      toAccountId: data.toAccountId || null,
      note: data.note || data.expenseName,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      source: "bank_statement",
      sourceId: `bank_stmt_${id}`,
      status: "confirmed",
    })
    .returning({ id: expenseTransactions.id });

  // Update the bank statement entry
  await db
    .update(bankStatementEntries)
    .set({
      expenseName: data.expenseName,
      expenseType: data.expenseType,
      categoryId: data.categoryId || null,
      accountId: data.accountId || null,
      fromAccountId: data.fromAccountId || null,
      toAccountId: data.toAccountId || null,
      note: data.note || null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      isClassified: true,
      expenseTransactionId: txn.id,
    })
    .where(eq(bankStatementEntries.id, id));

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function unclassifyBankStatementEntry(id: number) {
  const [entry] = await db
    .select()
    .from(bankStatementEntries)
    .where(eq(bankStatementEntries.id, id));

  if (!entry) throw new Error("Entry not found");

  const linkedTxnId = entry.expenseTransactionId;

  // Clear FK reference first
  await db
    .update(bankStatementEntries)
    .set({
      expenseName: null,
      expenseType: null,
      categoryId: null,
      accountId: null,
      fromAccountId: null,
      toAccountId: null,
      note: null,
      tags: null,
      isClassified: false,
      expenseTransactionId: null,
    })
    .where(eq(bankStatementEntries.id, id));

  // Now safe to delete the linked expense transaction
  if (linkedTxnId) {
    await db
      .delete(expenseTransactions)
      .where(eq(expenseTransactions.id, linkedTxnId));
  }

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function dismissBankStatementEntry(id: number) {
  const [entry] = await db
    .select()
    .from(bankStatementEntries)
    .where(eq(bankStatementEntries.id, id));

  if (!entry) throw new Error("Entry not found");

  const linkedTxnId = entry.expenseTransactionId;

  // Clear all fields and dismiss first (removes FK reference)
  await db
    .update(bankStatementEntries)
    .set({
      isDismissed: true,
      isClassified: false,
      expenseName: null,
      expenseType: null,
      categoryId: null,
      accountId: null,
      fromAccountId: null,
      toAccountId: null,
      note: null,
      tags: null,
      expenseTransactionId: null,
    })
    .where(eq(bankStatementEntries.id, id));

  // Now safe to delete the linked expense transaction
  if (linkedTxnId) {
    await db
      .delete(expenseTransactions)
      .where(eq(expenseTransactions.id, linkedTxnId));
  }

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function importBankStatementEntries(
  entries: {
    date: string;
    description: string;
    refNo?: string;
    debit?: number;
    credit?: number;
    balance?: number;
    accountNumber?: string;
    bankName?: string;
  }[]
) {
  if (entries.length === 0) return;

  // Get all existing refNos (including dismissed) to avoid re-adding
  const existing = await db
    .select({ refNo: bankStatementEntries.refNo, date: bankStatementEntries.date, debit: bankStatementEntries.debit, credit: bankStatementEntries.credit })
    .from(bankStatementEntries);

  const existingKeys = new Set(
    existing.map(e => `${e.date}|${e.refNo || ""}|${e.debit || ""}|${e.credit || ""}`)
  );

  const newEntries = entries.filter(e => {
    const key = `${e.date}|${e.refNo || ""}|${e.debit || ""}|${e.credit || ""}`;
    return !existingKeys.has(key);
  });

  if (newEntries.length === 0) return;

  await db.insert(bankStatementEntries).values(
    newEntries.map(e => ({
      date: e.date,
      description: e.description,
      refNo: e.refNo || null,
      debit: e.debit || null,
      credit: e.credit || null,
      balance: e.balance || null,
      accountNumber: e.accountNumber || null,
      bankName: e.bankName || null,
    }))
  );

  revalidatePath("/expenses-2");
}

export async function getBankStatementStats(startDate?: string, endDate?: string) {
  const conditions = [eq(bankStatementEntries.isDismissed, false)];
  if (startDate) conditions.push(gte(bankStatementEntries.date, startDate));
  if (endDate) conditions.push(lte(bankStatementEntries.date, endDate));

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      classified: sql<number>`sum(case when ${bankStatementEntries.isClassified} = 1 then 1 else 0 end)`,
      totalDebit: sql<number>`coalesce(sum(${bankStatementEntries.debit}), 0)`,
      totalCredit: sql<number>`coalesce(sum(${bankStatementEntries.credit}), 0)`,
    })
    .from(bankStatementEntries)
    .where(and(...conditions));

  return {
    total: stats?.total || 0,
    classified: stats?.classified || 0,
    unclassified: (stats?.total || 0) - (stats?.classified || 0),
    totalDebit: stats?.totalDebit || 0,
    totalCredit: stats?.totalCredit || 0,
  };
}
