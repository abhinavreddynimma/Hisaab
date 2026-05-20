"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bankStatementEntries, bankStatementSplits, expenseAccounts, expenseTransactions } from "@/db/schema";
import type { BankStatementEntry, BankStatementSplit, ExpenseTransactionType } from "@/lib/types";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";

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
  bucketTargetId?: number | null;
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
    bucketTargetId: split.bucketTargetId ?? null,
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
    // Other bank rows might share the same expense_transaction (merge group).
    // Break the group atomically so we don't leave dangling expense_transaction_id
    // refs after deleting the expense_transaction.
    const siblings: Array<{ id: number }> = tx
      .select({ id: bankStatementEntries.id })
      .from(bankStatementEntries)
      .where(and(
        inArray(bankStatementEntries.expenseTransactionId, linkedTxnIds),
        sql`${bankStatementEntries.id} != ${entryId}`,
      ))
      .all();
    if (siblings.length > 0) {
      tx.update(bankStatementEntries)
        .set({
          ...CLEARED_CLASSIFICATION,
          isDismissed: false,
        })
        .where(inArray(bankStatementEntries.id, siblings.map((s) => s.id)))
        .run();
      tx.delete(bankStatementSplits)
        .where(inArray(bankStatementSplits.bankStatementEntryId, siblings.map((s) => s.id)))
        .run();
    }

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
  await assertAdminAccess();
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

  // Lookup is_modification on the linked expense_transaction so the bank
  // page can style modification rows neutrally.
  const txnIds = entries.map((e) => e.expenseTransactionId).filter((v): v is number => v != null);
  const modByTxnId = new Map<number, boolean>();
  if (txnIds.length > 0) {
    const modRows = db
      .select({ id: expenseTransactions.id, isModification: expenseTransactions.isModification })
      .from(expenseTransactions)
      .where(inArray(expenseTransactions.id, txnIds))
      .all();
    for (const r of modRows) modByTxnId.set(r.id, !!r.isModification);
  }

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
      isModification: entry.expenseTransactionId != null ? (modByTxnId.get(entry.expenseTransactionId) ?? false) : false,
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
    bucketTargetId?: number | null;
    isModification?: boolean;
    /**
     * Override date for the expense_transaction. When omitted, the bank
     * row's own date is used. The bank row's date itself is never modified.
     */
    date?: string;
  },
) {
  await assertAdminAccess();
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
    const isMod = data.isModification ?? false;
    const result = tx.insert(expenseTransactions).values({
      type: data.expenseType,
      date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : entry.date,
      amount,
      categoryId: data.categoryId ?? null,
      accountId: data.accountId ?? null,
      fromAccountId: isMod ? null : (data.fromAccountId ?? null),
      toAccountId: data.toAccountId ?? null,
      note: note || data.expenseName.trim(),
      tags: data.tags ? JSON.stringify(data.tags) : null,
      source: "bank_statement",
      sourceId: `bank_stmt_${id}`,
      status: "confirmed",
      bucketTargetId: data.expenseType === "expense" ? (data.bucketTargetId ?? null) : null,
      isModification: isMod,
      createdAt: new Date().toISOString(),
    }).run();

    tx.update(bankStatementEntries)
      .set({
        expenseName: data.expenseName.trim(),
        expenseType: data.expenseType,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        fromAccountId: isMod ? null : (data.fromAccountId ?? null),
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

  revalidatePath("/bank");
  revalidatePath("/expenses");
}

/**
 * Merge-classify: N bank rows → 1 expense_transaction.
 * Every row gets `expense_transaction_id` pointing to the same new row, and is
 * marked classified with the supplied label. The expense_transaction's amount
 * is the sum of the bank-row amounts (all rows must be the same direction —
 * all debits or all credits — else we reject). Existing classifications on any
 * of the selected rows are cleared first.
 */
export async function classifyBankStatementsTogether(
  entryIds: number[],
  data: {
    expenseName: string;
    expenseType: ExpenseTransactionType;
    categoryId?: number | null;
    accountId?: number | null;
    fromAccountId?: number | null;
    toAccountId?: number | null;
    note?: string | null;
    tags?: string[] | null;
    bucketTargetId?: number | null;
    isModification?: boolean;
    date?: string;
  },
) {
  await assertAdminAccess();
  if (entryIds.length < 2) {
    throw new Error("Select at least two rows to merge");
  }
  if (!data.expenseName || !data.expenseName.trim()) {
    throw new Error("Classification name is required");
  }

  db.transaction((tx) => {
    const entries = tx
      .select()
      .from(bankStatementEntries)
      .where(inArray(bankStatementEntries.id, entryIds))
      .all();

    if (entries.length !== entryIds.length) {
      throw new Error("Some selected rows were not found");
    }
    if (entries.some((e) => e.isDismissed)) {
      throw new Error("One or more selected rows are dismissed");
    }

    const hasDebit = entries.some((e) => (e.debit ?? 0) > 0);
    const hasCredit = entries.some((e) => (e.credit ?? 0) > 0);
    if (hasDebit && hasCredit) {
      throw new Error("Cannot merge debit and credit rows together");
    }

    // Clear any existing classifications on the selected rows first
    for (const e of entries) {
      const existingSplitCount = tx
        .select({ count: sql<number>`count(*)` })
        .from(bankStatementSplits)
        .where(eq(bankStatementSplits.bankStatementEntryId, e.id))
        .get()?.count ?? 0;
      if (e.isClassified || e.expenseTransactionId || existingSplitCount > 0) {
        clearBankStatementClassification(tx, e.id);
      }
    }

    const totalAmount = roundCurrency(
      entries.reduce((sum, e) => sum + getEntryAmount(e), 0),
    );
    const latestDate = entries.map((e) => e.date).sort().pop()!;
    const note = data.note?.trim() || null;
    const isMod = data.isModification ?? false;

    const result = tx
      .insert(expenseTransactions)
      .values({
        type: data.expenseType,
        date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : latestDate,
        amount: totalAmount,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        fromAccountId: isMod ? null : (data.fromAccountId ?? null),
        toAccountId: data.toAccountId ?? null,
        note: note || data.expenseName.trim(),
        tags: data.tags ? JSON.stringify(data.tags) : null,
        source: "bank_statement",
        sourceId: `bank_stmt_merge_${entries.map((e) => e.id).join("_")}`,
        status: "confirmed",
        bucketTargetId: data.expenseType === "expense" ? (data.bucketTargetId ?? null) : null,
        isModification: isMod,
        createdAt: new Date().toISOString(),
      })
      .run();

    const expenseTransactionId = Number(result.lastInsertRowid);

    tx.update(bankStatementEntries)
      .set({
        expenseName: data.expenseName.trim(),
        expenseType: data.expenseType,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId ?? null,
        fromAccountId: isMod ? null : (data.fromAccountId ?? null),
        toAccountId: data.toAccountId ?? null,
        note,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        isClassified: true,
        isDismissed: false,
        expenseTransactionId,
      })
      .where(inArray(bankStatementEntries.id, entries.map((e) => e.id)))
      .run();
  });

  revalidatePath("/bank");
  revalidatePath("/expenses");
}

export async function classifyBankStatementEntryWithSplits(
  id: number,
  splits: BankStatementSplitInput[],
) {
  await assertAdminAccess();
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
        bucketTargetId: split.expenseType === "expense" ? split.bucketTargetId : null,
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

  revalidatePath("/bank");
  revalidatePath("/expenses");
}

export async function unclassifyBankStatementEntry(id: number) {
  await assertAdminAccess();
  db.transaction((tx) => {
    clearBankStatementClassification(tx, id);
  });

  revalidatePath("/bank");
  revalidatePath("/expenses");
}

export async function dismissBankStatementEntry(id: number) {
  await assertAdminAccess();
  db.transaction((tx) => {
    clearBankStatementClassification(tx, id, true);
  });

  revalidatePath("/bank");
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
  await assertAdminAccess();
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

  revalidatePath("/bank");
}

export async function getBankStatementStats(startDate?: string, endDate?: string) {
  await assertAdminAccess();
  const conditions = [eq(bankStatementEntries.isDismissed, false)];
  if (startDate) conditions.push(gte(bankStatementEntries.date, startDate));
  if (endDate) conditions.push(lte(bankStatementEntries.date, endDate));

  // Rows whose linked expense_transaction is a modification (opening balance /
  // adjustment) should be counted in `total` and `classified` but excluded
  // from the Credit / Debit / cumulative-balance sums — they're meant to
  // affect per-account balances, not bank-period flows.
  const isModificationSql = sql<number>`coalesce((select ${expenseTransactions.isModification} from ${expenseTransactions} where ${expenseTransactions.id} = ${bankStatementEntries.expenseTransactionId}), 0)`;

  const [stats] = db
    .select({
      total: sql<number>`count(*)`,
      classified: sql<number>`sum(case when ${bankStatementEntries.isClassified} = 1 then 1 else 0 end)`,
      totalDebit: sql<number>`coalesce(sum(case when ${isModificationSql} = 1 then 0 else ${bankStatementEntries.debit} end), 0)`,
      totalCredit: sql<number>`coalesce(sum(case when ${isModificationSql} = 1 then 0 else ${bankStatementEntries.credit} end), 0)`,
    })
    .from(bankStatementEntries)
    .where(and(...conditions))
    .all();

  // Cumulative balance: all non-dismissed entries from the earliest record up
  // to (and including) endDate. Defined as sum(credit) - sum(debit). Excludes
  // modification rows for the same reason as the Credit / Debit cards above.
  const cumulativeConditions = [eq(bankStatementEntries.isDismissed, false)];
  if (endDate) cumulativeConditions.push(lte(bankStatementEntries.date, endDate));
  const [balanceRow] = db
    .select({
      cumulativeBalance: sql<number>`coalesce(sum(case when ${isModificationSql} = 1 then 0 else ${bankStatementEntries.credit} end), 0) - coalesce(sum(case when ${isModificationSql} = 1 then 0 else ${bankStatementEntries.debit} end), 0)`,
    })
    .from(bankStatementEntries)
    .where(and(...cumulativeConditions))
    .all();

  return {
    total: stats?.total || 0,
    classified: stats?.classified || 0,
    unclassified: (stats?.total || 0) - (stats?.classified || 0),
    totalDebit: stats?.totalDebit || 0,
    totalCredit: stats?.totalCredit || 0,
    cumulativeBalance: balanceRow?.cumulativeBalance || 0,
  };
}

export async function deleteSplitExpenseTransaction(id: number) {
  await assertAdminAccess();
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

  revalidatePath("/bank");
  revalidatePath("/expenses");
}
