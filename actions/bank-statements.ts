"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bankStatementEntries, bankStatementSplits, expenseAccounts, expenseTransactions } from "@/db/schema";
import type { BankStatementEntry, BankStatementSplit, ExpenseTransactionType } from "@/lib/types";

type BankStatementSplitInput = {
  expenseName: string;
  expenseType: ExpenseTransactionType;
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  note?: string | null;
  tags?: string[] | null;
};

const CLEARED_CLASSIFICATION = {
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
} as const;

function getEntryAmount(entry: { debit: number | null; credit: number | null }) {
  return entry.debit || entry.credit || 0;
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function getSplitSummary(count: number) {
  return `Split into ${count} transactions`;
}

function normalizeSplit(split: BankStatementSplitInput) {
  return {
    expenseName: split.expenseName.trim(),
    expenseType: split.expenseType,
    amount: roundCurrency(split.amount),
    categoryId: split.categoryId ?? null,
    accountId: split.accountId ?? null,
    fromAccountId: split.fromAccountId ?? null,
    toAccountId: split.toAccountId ?? null,
    note: split.note?.trim() || null,
    tags: split.tags ?? null,
  };
}

function clearBankStatementClassification(
  tx: any,
  entryId: number,
  dismiss = false,
) {
  const entry = tx
    .select()
    .from(bankStatementEntries)
    .where(eq(bankStatementEntries.id, entryId))
    .get();

  if (!entry) {
    throw new Error("Entry not found");
  }

  const splitLinks: Array<{ expenseTransactionId: number }> = tx
    .select({ expenseTransactionId: bankStatementSplits.expenseTransactionId })
    .from(bankStatementSplits)
    .where(eq(bankStatementSplits.bankStatementEntryId, entryId))
    .all();

  const linkedTxnIds = [...new Set([
    ...splitLinks.map((link) => link.expenseTransactionId),
    ...(entry.expenseTransactionId ? [entry.expenseTransactionId] : []),
  ])];

  if (splitLinks.length > 0) {
    tx.delete(bankStatementSplits)
      .where(eq(bankStatementSplits.bankStatementEntryId, entryId))
      .run();
  }

  tx.update(bankStatementEntries)
    .set({
      ...CLEARED_CLASSIFICATION,
      isDismissed: dismiss,
    })
    .where(eq(bankStatementEntries.id, entryId))
    .run();

  if (linkedTxnIds.length > 0) {
    tx.delete(expenseTransactions)
      .where(inArray(expenseTransactions.id, linkedTxnIds))
      .run();
  }
}

function syncBankStatementAfterSplitMutation(tx: any, entryId: number) {
  const remaining = tx
    .select({
      splitId: bankStatementSplits.id,
      expenseTransactionId: bankStatementSplits.expenseTransactionId,
      expenseName: bankStatementSplits.expenseName,
      type: expenseTransactions.type,
      categoryId: expenseTransactions.categoryId,
      accountId: expenseTransactions.accountId,
      fromAccountId: expenseTransactions.fromAccountId,
      toAccountId: expenseTransactions.toAccountId,
      note: expenseTransactions.note,
      tags: expenseTransactions.tags,
    })
    .from(bankStatementSplits)
    .innerJoin(expenseTransactions, eq(bankStatementSplits.expenseTransactionId, expenseTransactions.id))
    .where(eq(bankStatementSplits.bankStatementEntryId, entryId))
    .orderBy(asc(bankStatementSplits.sortOrder), asc(bankStatementSplits.id))
    .all();

  if (remaining.length === 0) {
    tx.update(bankStatementEntries)
      .set({
        ...CLEARED_CLASSIFICATION,
        isDismissed: false,
      })
      .where(eq(bankStatementEntries.id, entryId))
      .run();
    return;
  }

  if (remaining.length === 1) {
    const [only] = remaining;

    tx.delete(bankStatementSplits)
      .where(eq(bankStatementSplits.bankStatementEntryId, entryId))
      .run();

    tx.update(bankStatementEntries)
      .set({
        expenseName: only.expenseName,
        expenseType: only.type,
        categoryId: only.categoryId,
        accountId: only.accountId,
        fromAccountId: only.fromAccountId,
        toAccountId: only.toAccountId,
        note: only.note,
        tags: only.tags,
        isClassified: true,
        isDismissed: false,
        expenseTransactionId: only.expenseTransactionId,
      })
      .where(eq(bankStatementEntries.id, entryId))
      .run();

    return;
  }

  tx.update(bankStatementEntries)
    .set({
      ...CLEARED_CLASSIFICATION,
      expenseName: getSplitSummary(remaining.length),
      isClassified: true,
      isDismissed: false,
    })
    .where(eq(bankStatementEntries.id, entryId))
    .run();
}

export async function getBankStatementEntries(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<BankStatementEntry[]> {
  const conditions = [eq(bankStatementEntries.isDismissed, false)];
  if (filters?.startDate) conditions.push(gte(bankStatementEntries.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(bankStatementEntries.date, filters.endDate));

  const rows = db
    .select({
      id: bankStatementEntries.id,
      date: bankStatementEntries.date,
      description: bankStatementEntries.description,
      time: bankStatementEntries.time,
      phonepeName: bankStatementEntries.phonepeName,
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
    .orderBy(bankStatementEntries.date)
    .all();

  return rows as BankStatementEntry[];
}

export async function getBankStatementEntriesWithNames(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<BankStatementEntry[]> {
  const entries = await getBankStatementEntries(filters);
  if (entries.length === 0) return [];

  const accounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));

  const splitRows = db
    .select({
      id: bankStatementSplits.id,
      bankStatementEntryId: bankStatementSplits.bankStatementEntryId,
      expenseTransactionId: bankStatementSplits.expenseTransactionId,
      expenseName: bankStatementSplits.expenseName,
      amount: bankStatementSplits.amount,
      sortOrder: bankStatementSplits.sortOrder,
      createdAt: bankStatementSplits.createdAt,
      expenseType: expenseTransactions.type,
      categoryId: expenseTransactions.categoryId,
      accountId: expenseTransactions.accountId,
      fromAccountId: expenseTransactions.fromAccountId,
      toAccountId: expenseTransactions.toAccountId,
      note: expenseTransactions.note,
      tags: expenseTransactions.tags,
    })
    .from(bankStatementSplits)
    .innerJoin(expenseTransactions, eq(bankStatementSplits.expenseTransactionId, expenseTransactions.id))
    .where(inArray(bankStatementSplits.bankStatementEntryId, entries.map((entry) => entry.id)))
    .orderBy(asc(bankStatementSplits.bankStatementEntryId), asc(bankStatementSplits.sortOrder), asc(bankStatementSplits.id))
    .all();

  const splitsByEntry = new Map<number, BankStatementSplit[]>();
  for (const row of splitRows) {
    const split: BankStatementSplit = {
      id: row.id,
      bankStatementEntryId: row.bankStatementEntryId,
      expenseTransactionId: row.expenseTransactionId,
      expenseName: row.expenseName,
      amount: row.amount,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      expenseType: row.expenseType,
      categoryId: row.categoryId,
      accountId: row.accountId,
      fromAccountId: row.fromAccountId,
      toAccountId: row.toAccountId,
      note: row.note,
      tags: row.tags,
      categoryName: row.categoryId ? accountMap.get(row.categoryId) ?? undefined : undefined,
      accountName: row.accountId ? accountMap.get(row.accountId) ?? undefined : undefined,
      fromAccountName: row.fromAccountId ? accountMap.get(row.fromAccountId) ?? undefined : undefined,
      toAccountName: row.toAccountId ? accountMap.get(row.toAccountId) ?? undefined : undefined,
    };

    const existing = splitsByEntry.get(row.bankStatementEntryId) ?? [];
    existing.push(split);
    splitsByEntry.set(row.bankStatementEntryId, existing);
  }

  return entries.map((entry) => {
    const splits = splitsByEntry.get(entry.id) ?? [];
    const mappedEntry: BankStatementEntry = {
      ...entry,
      categoryName: entry.categoryId ? accountMap.get(entry.categoryId) ?? undefined : undefined,
      accountName: entry.accountId ? accountMap.get(entry.accountId) ?? undefined : undefined,
      fromAccountName: entry.fromAccountId ? accountMap.get(entry.fromAccountId) ?? undefined : undefined,
      toAccountName: entry.toAccountId ? accountMap.get(entry.toAccountId) ?? undefined : undefined,
      splitCount: splits.length || undefined,
      splits: splits.length > 0 ? splits : undefined,
    };

    if (splits.length === 1) {
      const [split] = splits;
      return {
        ...mappedEntry,
        expenseName: split.expenseName,
        expenseType: split.expenseType,
        categoryId: split.categoryId,
        accountId: split.accountId,
        fromAccountId: split.fromAccountId,
        toAccountId: split.toAccountId,
        note: split.note,
        tags: split.tags,
        expenseTransactionId: split.expenseTransactionId,
        categoryName: split.categoryName,
        accountName: split.accountName,
        fromAccountName: split.fromAccountName,
        toAccountName: split.toAccountName,
      };
    }

    if (splits.length > 1) {
      return {
        ...mappedEntry,
        expenseName: entry.expenseName || getSplitSummary(splits.length),
        expenseType: null,
        categoryId: null,
        accountId: null,
        fromAccountId: null,
        toAccountId: null,
        note: null,
        tags: null,
        expenseTransactionId: null,
      };
    }

    return mappedEntry;
  });
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
  },
) {
  db.transaction((tx) => {
    const entry = tx
      .select()
      .from(bankStatementEntries)
      .where(eq(bankStatementEntries.id, id))
      .get();

    if (!entry) {
      throw new Error("Entry not found");
    }

    const existingSplitCount = tx
      .select({ count: sql<number>`count(*)` })
      .from(bankStatementSplits)
      .where(eq(bankStatementSplits.bankStatementEntryId, id))
      .get()?.count ?? 0;

    if (entry.isClassified || entry.expenseTransactionId || existingSplitCount > 0) {
      clearBankStatementClassification(tx, id);
    }

    const amount = getEntryAmount(entry);
    const note = data.note?.trim() || null;
    const result = tx.insert(expenseTransactions).values({
      type: data.expenseType,
      date: entry.date,
      amount,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId ?? null,
      fromAccountId: data.fromAccountId ?? null,
      toAccountId: data.toAccountId ?? null,
      note: note || data.expenseName.trim(),
      tags: data.tags ? JSON.stringify(data.tags) : null,
      source: "bank_statement",
      sourceId: `bank_stmt_${id}`,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    }).run();

    tx.update(bankStatementEntries)
      .set({
        expenseName: data.expenseName.trim(),
        expenseType: data.expenseType,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        fromAccountId: data.fromAccountId ?? null,
        toAccountId: data.toAccountId ?? null,
        note,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        isClassified: true,
        isDismissed: false,
        expenseTransactionId: Number(result.lastInsertRowid),
      })
      .where(eq(bankStatementEntries.id, id))
      .run();
  });

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function classifyBankStatementEntryWithSplits(
  id: number,
  splits: BankStatementSplitInput[],
) {
  const normalizedSplits = splits.map(normalizeSplit);
  if (normalizedSplits.length < 2) {
    throw new Error("At least two split lines are required");
  }

  if (normalizedSplits.some((split) => !split.expenseName || split.amount <= 0)) {
    throw new Error("Each split needs a name and a positive amount");
  }

  db.transaction((tx) => {
    const entry = tx
      .select()
      .from(bankStatementEntries)
      .where(eq(bankStatementEntries.id, id))
      .get();

    if (!entry) {
      throw new Error("Entry not found");
    }

    const entryAmount = roundCurrency(getEntryAmount(entry));
    const splitTotal = roundCurrency(
      normalizedSplits.reduce((sum, split) => sum + split.amount, 0),
    );

    if (splitTotal !== entryAmount) {
      throw new Error("Split total must match the transaction amount");
    }

    const existingSplitCount = tx
      .select({ count: sql<number>`count(*)` })
      .from(bankStatementSplits)
      .where(eq(bankStatementSplits.bankStatementEntryId, id))
      .get()?.count ?? 0;

    if (entry.isClassified || entry.expenseTransactionId || existingSplitCount > 0) {
      clearBankStatementClassification(tx, id);
    }

    for (const [index, split] of normalizedSplits.entries()) {
      const createdAt = new Date().toISOString();
      const result = tx.insert(expenseTransactions).values({
        type: split.expenseType,
        date: entry.date,
        amount: split.amount,
        categoryId: split.categoryId,
        accountId: split.accountId,
        fromAccountId: split.fromAccountId,
        toAccountId: split.toAccountId,
        note: split.note || split.expenseName,
        tags: split.tags ? JSON.stringify(split.tags) : null,
        source: "bank_statement",
        sourceId: `bank_stmt_${id}_split_${index + 1}`,
        status: "confirmed",
        createdAt,
      }).run();

      tx.insert(bankStatementSplits).values({
        bankStatementEntryId: id,
        expenseTransactionId: Number(result.lastInsertRowid),
        expenseName: split.expenseName,
        amount: split.amount,
        sortOrder: index,
        createdAt,
      }).run();
    }

    tx.update(bankStatementEntries)
      .set({
        ...CLEARED_CLASSIFICATION,
        expenseName: getSplitSummary(normalizedSplits.length),
        isClassified: true,
        isDismissed: false,
      })
      .where(eq(bankStatementEntries.id, id))
      .run();
  });

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function unclassifyBankStatementEntry(id: number) {
  db.transaction((tx) => {
    clearBankStatementClassification(tx, id);
  });

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}

export async function dismissBankStatementEntry(id: number) {
  db.transaction((tx) => {
    clearBankStatementClassification(tx, id, true);
  });

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
  }[],
) {
  if (entries.length === 0) return;

  const existing = db
    .select({
      refNo: bankStatementEntries.refNo,
      date: bankStatementEntries.date,
      debit: bankStatementEntries.debit,
      credit: bankStatementEntries.credit,
    })
    .from(bankStatementEntries)
    .all();

  const existingKeys = new Set(
    existing.map((entry) => `${entry.date}|${entry.refNo || ""}|${entry.debit || ""}|${entry.credit || ""}`),
  );

  const newEntries = entries.filter((entry) => {
    const key = `${entry.date}|${entry.refNo || ""}|${entry.debit || ""}|${entry.credit || ""}`;
    return !existingKeys.has(key);
  });

  if (newEntries.length === 0) return;

  db.insert(bankStatementEntries).values(
    newEntries.map((entry) => ({
      date: entry.date,
      description: entry.description,
      refNo: entry.refNo || null,
      debit: entry.debit || null,
      credit: entry.credit || null,
      balance: entry.balance || null,
      accountNumber: entry.accountNumber || null,
      bankName: entry.bankName || null,
    })),
  ).run();

  revalidatePath("/expenses-2");
}

export async function getBankStatementStats(startDate?: string, endDate?: string) {
  const conditions = [eq(bankStatementEntries.isDismissed, false)];
  if (startDate) conditions.push(gte(bankStatementEntries.date, startDate));
  if (endDate) conditions.push(lte(bankStatementEntries.date, endDate));

  const [stats] = db
    .select({
      total: sql<number>`count(*)`,
      classified: sql<number>`sum(case when ${bankStatementEntries.isClassified} = 1 then 1 else 0 end)`,
      totalDebit: sql<number>`coalesce(sum(${bankStatementEntries.debit}), 0)`,
      totalCredit: sql<number>`coalesce(sum(${bankStatementEntries.credit}), 0)`,
    })
    .from(bankStatementEntries)
    .where(and(...conditions))
    .all();

  return {
    total: stats?.total || 0,
    classified: stats?.classified || 0,
    unclassified: (stats?.total || 0) - (stats?.classified || 0),
    totalDebit: stats?.totalDebit || 0,
    totalCredit: stats?.totalCredit || 0,
  };
}

export async function deleteSplitExpenseTransaction(id: number) {
  db.transaction((tx) => {
    const splitLink = tx
      .select({ bankStatementEntryId: bankStatementSplits.bankStatementEntryId })
      .from(bankStatementSplits)
      .where(eq(bankStatementSplits.expenseTransactionId, id))
      .get();

    if (!splitLink) {
      tx.delete(expenseTransactions).where(eq(expenseTransactions.id, id)).run();
      return;
    }

    tx.delete(bankStatementSplits)
      .where(eq(bankStatementSplits.expenseTransactionId, id))
      .run();

    tx.delete(expenseTransactions)
      .where(eq(expenseTransactions.id, id))
      .run();

    syncBankStatementAfterSplitMutation(tx, splitLink.bankStatementEntryId);
  });

  revalidatePath("/expenses-2");
  revalidatePath("/expenses");
}
