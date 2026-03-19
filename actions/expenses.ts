"use server";

import { db } from "@/db";
import { expenseAccounts, expenseTransactions, expenseBudgets, expenseBudgetCategories, expenseTargets, expenseTargetAccounts } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { assertAdminAccess } from "@/lib/auth";
import { DEFAULT_EXPENSE_CATEGORIES, getFYDateRange, getMonthDateRange } from "@/lib/constants";
import type { ExpenseAccount, ExpenseAccountType, ExpenseTransaction, ExpenseTransactionType, ExpenseBudget, ExpenseTarget } from "@/lib/types";

// ============================================================
// ACCOUNTS
// ============================================================

export async function getExpenseAccounts(type?: ExpenseAccountType): Promise<ExpenseAccount[]> {
  await assertAdminAccess();
  if (type) {
    return db.select().from(expenseAccounts)
      .where(eq(expenseAccounts.type, type))
      .orderBy(expenseAccounts.sortOrder, expenseAccounts.name)
      .all() as ExpenseAccount[];
  }
  return db.select().from(expenseAccounts)
    .orderBy(expenseAccounts.sortOrder, expenseAccounts.name)
    .all() as ExpenseAccount[];
}

export async function getExpenseAccountsGrouped(): Promise<{
  type: ExpenseAccountType;
  label: string;
  accounts: (ExpenseAccount & { children: ExpenseAccount[]; balance: number })[];
  totalBalance: number;
}[]> {
  await assertAdminAccess();
  const allAccounts = await getExpenseAccounts();
  const activeAccounts = allAccounts.filter(a => a.isActive);

  // Compute balances from transactions
  const balances = new Map<number, number>();
  const allTxns = db.select().from(expenseTransactions).all();
  for (const txn of allTxns) {
    if (txn.type === "income" && txn.accountId) {
      balances.set(txn.accountId, (balances.get(txn.accountId) ?? 0) + txn.amount);
    }
    if (txn.type === "expense" && txn.accountId) {
      balances.set(txn.accountId, (balances.get(txn.accountId) ?? 0) - txn.amount);
    }
    if (txn.type === "transfer") {
      if (txn.fromAccountId) {
        balances.set(txn.fromAccountId, (balances.get(txn.fromAccountId) ?? 0) - txn.amount - (txn.fees ?? 0));
      }
      if (txn.toAccountId) {
        balances.set(txn.toAccountId, (balances.get(txn.toAccountId) ?? 0) + txn.amount);
      }
    }
  }

  const typeOrder: ExpenseAccountType[] = ["cash", "bank", "income", "expense", "investment", "savings"];
  const typeLabels: Record<ExpenseAccountType, string> = {
    cash: "Cash", bank: "Bank Accounts", income: "Income Sources",
    expense: "Expense Categories", investment: "Investments", savings: "Savings",
  };

  // Helper to sum balance for an account + all descendants
  function getAggregateBalance(accountId: number): number {
    let total = balances.get(accountId) ?? 0;
    for (const acc of activeAccounts) {
      if (acc.parentId === accountId) {
        total += getAggregateBalance(acc.id);
      }
    }
    return total;
  }

  return typeOrder.map(type => {
    const topLevel = activeAccounts.filter(a => a.type === type && !a.parentId);
    const accounts = topLevel.map(acc => {
      const children = activeAccounts.filter(a => a.parentId === acc.id).map(child => {
        const grandchildren = activeAccounts.filter(a => a.parentId === child.id);
        return { ...child, children: grandchildren };
      });
      const balance = getAggregateBalance(acc.id);
      return { ...acc, children, balance };
    });
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    return { type, label: typeLabels[type], accounts, totalBalance };
  });
}

export async function createExpenseAccount(data: {
  name: string;
  type: ExpenseAccountType;
  parentId?: number | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db.insert(expenseAccounts).values({
    name: data.name,
    type: data.type,
    parentId: data.parentId ?? null,
    icon: data.icon ?? null,
    color: data.color ?? null,
    sortOrder: data.sortOrder ?? 0,
  }).run();
  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateExpenseAccount(id: number, data: {
  name?: string;
  type?: ExpenseAccountType;
  parentId?: number | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
}): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  db.update(expenseAccounts).set(updateData).where(eq(expenseAccounts.id, id)).run();
  return { success: true };
}

export async function toggleExpenseAccountActive(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const account = db.select().from(expenseAccounts).where(eq(expenseAccounts.id, id)).get();
  if (!account) return { success: false };
  db.update(expenseAccounts)
    .set({ isActive: !account.isActive })
    .where(eq(expenseAccounts.id, id))
    .run();
  return { success: true };
}

export async function seedDefaultAccounts(): Promise<{ success: boolean }> {
  await assertAdminAccess();

  const existing = db.select().from(expenseAccounts).limit(1).all();
  if (existing.length > 0) return { success: true };

  for (const [type, config] of Object.entries(DEFAULT_EXPENSE_CATEGORIES)) {
    for (const [idx, name] of config.items.entries()) {
      const result = db.insert(expenseAccounts).values({
        name,
        type: type as ExpenseAccountType,
        sortOrder: idx,
      }).run();

      const parentId = Number(result.lastInsertRowid);
      const subCats = config.subCategories?.[name];
      if (subCats) {
        for (const [subIdx, subName] of subCats.entries()) {
          const subResult = db.insert(expenseAccounts).values({
            name: subName,
            type: type as ExpenseAccountType,
            parentId,
            sortOrder: subIdx,
          }).run();

          // 3rd level: sub-sub-categories
          const subSubItems = config.subSubCategories?.[subName];
          if (subSubItems) {
            const subParentId = Number(subResult.lastInsertRowid);
            for (const [ssIdx, ssName] of subSubItems.entries()) {
              db.insert(expenseAccounts).values({
                name: ssName,
                type: type as ExpenseAccountType,
                parentId: subParentId,
                sortOrder: ssIdx,
              }).run();
            }
          }
        }
      }
    }
  }

  return { success: true };
}

export async function resetExpenseData(): Promise<{ success: boolean }> {
  await assertAdminAccess();
  // Delete in order to respect foreign keys
  db.delete(expenseTargetAccounts).run();
  db.delete(expenseTargets).run();
  db.delete(expenseBudgetCategories).run();
  db.delete(expenseBudgets).run();
  db.delete(expenseTransactions).run();
  db.delete(expenseAccounts).run();
  return { success: true };
}

// ============================================================
// TRANSACTIONS
// ============================================================

export async function getExpenseTransactions(filters: {
  startDate: string;
  endDate: string;
  type?: ExpenseTransactionType;
  categoryId?: number;
  accountId?: number;
}): Promise<ExpenseTransaction[]> {
  await assertAdminAccess();

  const conditions = [
    sql`${expenseTransactions.date} >= ${filters.startDate}`,
    sql`${expenseTransactions.date} <= ${filters.endDate}`,
  ];

  if (filters.type) {
    conditions.push(eq(expenseTransactions.type, filters.type));
  }
  if (filters.categoryId) {
    conditions.push(eq(expenseTransactions.categoryId, filters.categoryId));
  }
  if (filters.accountId) {
    conditions.push(
      sql`(${expenseTransactions.accountId} = ${filters.accountId} OR ${expenseTransactions.fromAccountId} = ${filters.accountId} OR ${expenseTransactions.toAccountId} = ${filters.accountId})`
    );
  }

  const txns = db.select().from(expenseTransactions)
    .where(and(...conditions))
    .orderBy(desc(expenseTransactions.date), desc(expenseTransactions.createdAt))
    .all() as ExpenseTransaction[];

  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a.name]));

  return txns.map(txn => ({
    ...txn,
    categoryName: txn.categoryId ? accountMap.get(txn.categoryId) ?? undefined : undefined,
    accountName: txn.accountId ? accountMap.get(txn.accountId) ?? undefined : undefined,
    fromAccountName: txn.fromAccountId ? accountMap.get(txn.fromAccountId) ?? undefined : undefined,
    toAccountName: txn.toAccountId ? accountMap.get(txn.toAccountId) ?? undefined : undefined,
  }));
}

export async function createExpenseTransaction(data: {
  type: ExpenseTransactionType;
  date: string;
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  fees?: number | null;
  note?: string | null;
  tags?: string[] | null;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();

  const result = db.insert(expenseTransactions).values({
    type: data.type,
    date: data.date,
    amount: data.amount,
    categoryId: data.categoryId ?? null,
    accountId: data.accountId ?? null,
    fromAccountId: data.fromAccountId ?? null,
    toAccountId: data.toAccountId ?? null,
    fees: data.fees ?? 0,
    note: data.note ?? null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
  }).run();

  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateExpenseTransaction(id: number, data: {
  type: ExpenseTransactionType;
  date: string;
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
  fees?: number | null;
  note?: string | null;
  tags?: string[] | null;
}): Promise<{ success: boolean }> {
  await assertAdminAccess();

  db.update(expenseTransactions).set({
    type: data.type,
    date: data.date,
    amount: data.amount,
    categoryId: data.categoryId ?? null,
    accountId: data.accountId ?? null,
    fromAccountId: data.fromAccountId ?? null,
    toAccountId: data.toAccountId ?? null,
    fees: data.fees ?? 0,
    note: data.note ?? null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
  }).where(eq(expenseTransactions.id, id)).run();

  return { success: true };
}

export async function deleteExpenseTransaction(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(expenseTransactions).where(eq(expenseTransactions.id, id)).run();
  return { success: true };
}

// ============================================================
// STATS
// ============================================================

export async function getExpenseStats(startDate: string, endDate: string): Promise<{
  totalIncome: number;
  totalExpenses: number;
  totalTax: number;
  totalTransfersOut: number;
  net: number;
  incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
  expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
  transfersByType: { type: string; amount: number; percentage: number; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
  topLevelSplit: {
    postTaxIncome: number;
    investments: { amount: number; percentage: number };
    savings: { amount: number; percentage: number };
    expenses: { amount: number; percentage: number };
  };
}> {
  await assertAdminAccess();

  const txns = db.select().from(expenseTransactions)
    .where(and(
      sql`${expenseTransactions.date} >= ${startDate}`,
      sql`${expenseTransactions.date} <= ${endDate}`,
    ))
    .all();

  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  // Walk up parentId chain to root ancestor
  function getRootAncestor(id: number): number {
    const acc = accountMap.get(id);
    if (!acc || !acc.parentId) return id;
    return getRootAncestor(acc.parentId);
  }

  const incomeMap = new Map<number, number>();
  let totalIncome = 0;
  for (const txn of txns) {
    if (txn.type === "income" && txn.categoryId) {
      incomeMap.set(txn.categoryId, (incomeMap.get(txn.categoryId) ?? 0) + txn.amount);
      totalIncome += txn.amount;
    }
  }

  // Roll up expenses to root ancestor category + track sub-categories
  const expenseMap = new Map<number, number>();
  const expenseSubMap = new Map<number, Map<number, number>>(); // rootId -> (categoryId -> amount)
  let totalExpenses = 0;
  let taxExpenses = 0;
  for (const txn of txns) {
    if (txn.type === "expense" && txn.categoryId) {
      const rootId = getRootAncestor(txn.categoryId);
      expenseMap.set(rootId, (expenseMap.get(rootId) ?? 0) + txn.amount);
      totalExpenses += txn.amount;

      // Track sub-category amounts (only if different from root)
      if (txn.categoryId !== rootId) {
        if (!expenseSubMap.has(rootId)) expenseSubMap.set(rootId, new Map());
        const subMap = expenseSubMap.get(rootId)!;
        subMap.set(txn.categoryId, (subMap.get(txn.categoryId) ?? 0) + txn.amount);
      }

      // Check if this is a tax expense
      const rootAcc = accountMap.get(rootId);
      if (rootAcc?.name === "Tax") {
        taxExpenses += txn.amount;
      }
    }
  }

  const transferTypeMap = new Map<string, number>();
  const transferSubMap = new Map<string, Map<number, number>>(); // "Investments"/"Savings" -> (accountId -> amount)
  let totalTransfersOut = 0;
  let investmentTransfers = 0;
  let savingsTransfers = 0;
  for (const txn of txns) {
    if (txn.type === "transfer" && txn.toAccountId) {
      const toAccount = accountMap.get(txn.toAccountId);
      const rootId = txn.toAccountId ? getRootAncestor(txn.toAccountId) : txn.toAccountId;
      const rootAccount = accountMap.get(rootId);
      const accountType = rootAccount?.type ?? toAccount?.type;

      if (accountType === "investment" || accountType === "savings") {
        const typeLabel = accountType === "investment" ? "Investments" : "Savings";
        transferTypeMap.set(typeLabel, (transferTypeMap.get(typeLabel) ?? 0) + txn.amount);
        totalTransfersOut += txn.amount;
        if (accountType === "investment") investmentTransfers += txn.amount;
        if (accountType === "savings") savingsTransfers += txn.amount;

        // Track individual account within type
        if (!transferSubMap.has(typeLabel)) transferSubMap.set(typeLabel, new Map());
        const subMap = transferSubMap.get(typeLabel)!;
        // Use the direct toAccountId (not root) for granular view
        const trackId = txn.toAccountId;
        subMap.set(trackId, (subMap.get(trackId) ?? 0) + txn.amount);
      }
    }
  }

  const totalOutflow = totalExpenses + totalTransfersOut;
  const nonTaxExpenses = totalExpenses - taxExpenses;

  // 50:20:30 split (post-tax)
  const postTaxIncome = totalIncome - taxExpenses;
  const topLevelSplit = {
    postTaxIncome,
    investments: {
      amount: investmentTransfers,
      percentage: postTaxIncome > 0 ? Math.round((investmentTransfers / postTaxIncome) * 100) : 0,
    },
    savings: {
      amount: savingsTransfers,
      percentage: postTaxIncome > 0 ? Math.round((savingsTransfers / postTaxIncome) * 100) : 0,
    },
    expenses: {
      amount: nonTaxExpenses,
      percentage: postTaxIncome > 0 ? Math.round((nonTaxExpenses / postTaxIncome) * 100) : 0,
    },
  };

  const incomeByCategory = Array.from(incomeMap.entries())
    .map(([id, amount]) => {
      const acc = accountMap.get(id);
      return { id, name: acc?.name ?? "Unknown", amount, percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0, color: acc?.color ?? null };
    })
    .sort((a, b) => b.amount - a.amount);

  // Exclude Tax from expense breakdown — it gets its own section
  const expenseByCategory = Array.from(expenseMap.entries())
    .filter(([id]) => {
      const acc = accountMap.get(id);
      return acc?.name !== "Tax";
    })
    .map(([id, amount]) => {
      const acc = accountMap.get(id);
      const nonTaxOutflow = nonTaxExpenses + totalTransfersOut;
      const subMap = expenseSubMap.get(id);
      const subCategories = subMap
        ? Array.from(subMap.entries())
            .map(([subId, subAmt]) => {
              const subAcc = accountMap.get(subId);
              return { id: subId, name: subAcc?.name ?? "Unknown", amount: subAmt, percentage: amount > 0 ? Math.round((subAmt / amount) * 100) : 0, color: subAcc?.color ?? null };
            })
            .sort((a, b) => b.amount - a.amount)
        : [];
      return { id, name: acc?.name ?? "Unknown", amount, percentage: nonTaxOutflow > 0 ? Math.round((amount / nonTaxOutflow) * 100) : 0, color: acc?.color ?? null, subCategories };
    })
    .sort((a, b) => b.amount - a.amount);

  const transfersByType = Array.from(transferTypeMap.entries())
    .map(([type, amount]) => {
      const nonTaxOutflow = nonTaxExpenses + totalTransfersOut;
      const subMap = transferSubMap.get(type);
      const subCategories = subMap
        ? Array.from(subMap.entries())
            .map(([subId, subAmt]) => {
              const subAcc = accountMap.get(subId);
              return { id: subId, name: subAcc?.name ?? "Unknown", amount: subAmt, percentage: amount > 0 ? Math.round((subAmt / amount) * 100) : 0, color: subAcc?.color ?? null };
            })
            .sort((a, b) => b.amount - a.amount)
        : [];
      return { type, amount, percentage: nonTaxOutflow > 0 ? Math.round((amount / nonTaxOutflow) * 100) : 0, subCategories };
    })
    .sort((a, b) => b.amount - a.amount);

  return { totalIncome, totalExpenses: nonTaxExpenses, totalTax: taxExpenses, totalTransfersOut, net: totalIncome - totalExpenses - totalTransfersOut, incomeByCategory, expenseByCategory, transfersByType, topLevelSplit };
}

export async function getExpenseMonthlyOverview(year: number, month: number): Promise<{
  weeks: { label: string; income: number; expense: number; net: number }[];
  totalIncome: number;
  totalExpenses: number;
}> {
  await assertAdminAccess();

  const { start, end } = getMonthDateRange(year, month);
  const txns = db.select().from(expenseTransactions)
    .where(and(
      sql`${expenseTransactions.date} >= ${start}`,
      sql`${expenseTransactions.date} <= ${end}`,
    ))
    .all();

  const lastDay = new Date(year, month, 0).getDate();
  const weeks: { label: string; income: number; expense: number; net: number }[] = [];

  for (let weekStart = 1; weekStart <= lastDay; weekStart += 7) {
    const weekEnd = Math.min(weekStart + 6, lastDay);
    const startStr = `${year}-${String(month).padStart(2, "0")}-${String(weekStart).padStart(2, "0")}`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(weekEnd).padStart(2, "0")}`;

    let income = 0, expense = 0;
    for (const txn of txns) {
      if (txn.date >= startStr && txn.date <= endStr) {
        if (txn.type === "income") income += txn.amount;
        if (txn.type === "expense") expense += txn.amount;
        if (txn.type === "transfer") expense += txn.amount;
      }
    }

    weeks.push({
      label: `${String(weekStart).padStart(2, "0")}/${String(month).padStart(2, "0")} ~ ${String(weekEnd).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
      income, expense, net: income - expense,
    });
  }

  const totalIncome = txns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txns.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);

  return { weeks, totalIncome, totalExpenses };
}

export async function getExpenseFYOverview(financialYear: string): Promise<{
  months: { month: string; year: number; monthNum: number; income: number; expense: number; net: number }[];
  totalIncome: number;
  totalExpenses: number;
}> {
  await assertAdminAccess();

  const { start, end } = getFYDateRange(financialYear);
  const startYear = parseInt(financialYear.split("-")[0]);

  const txns = db.select().from(expenseTransactions)
    .where(and(
      sql`${expenseTransactions.date} >= ${start}`,
      sql`${expenseTransactions.date} <= ${end}`,
    ))
    .all();

  const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const months = monthLabels.map((label, idx) => {
    const calYear = idx < 9 ? startYear : startYear + 1;
    const calMonth = idx < 9 ? idx + 4 : idx - 8;
    const { start: mStart, end: mEnd } = getMonthDateRange(calYear, calMonth);

    let income = 0, expense = 0;
    for (const txn of txns) {
      if (txn.date >= mStart && txn.date <= mEnd) {
        if (txn.type === "income") income += txn.amount;
        else expense += txn.amount;
      }
    }

    return { month: label, year: calYear, monthNum: calMonth, income, expense, net: income - expense };
  });

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expense, 0);

  return { months, totalIncome, totalExpenses };
}

export async function getBudgetMonthlyTrend(budgetId: number, financialYear: string): Promise<{
  months: { month: string; amount: number }[];
  average: number;
  categoryBreakdown: { name: string; amount: number; color: string | null }[];
}> {
  await assertAdminAccess();

  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  // Get budget's linked category IDs
  const links = db.select().from(expenseBudgetCategories).where(eq(expenseBudgetCategories.budgetId, budgetId)).all();
  const categoryIds = links.map(l => l.categoryId);

  // Recursively expand to all descendants
  const allCategoryIds = new Set(categoryIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const acc of allAccounts) {
      if (acc.parentId && allCategoryIds.has(acc.parentId) && !allCategoryIds.has(acc.id)) {
        allCategoryIds.add(acc.id);
        changed = true;
      }
    }
  }

  // Get all expense transactions for the FY that match these categories
  const { start: fyStart, end: fyEnd } = getFYDateRange(financialYear);
  const txns = db.select().from(expenseTransactions)
    .where(and(
      eq(expenseTransactions.type, "expense"),
      sql`${expenseTransactions.date} >= ${fyStart}`,
      sql`${expenseTransactions.date} <= ${fyEnd}`,
    ))
    .all()
    .filter(t => t.categoryId && allCategoryIds.has(t.categoryId));

  // Build monthly trend (Apr → Mar)
  const startYear = parseInt(financialYear.split("-")[0]);
  const months: { month: string; amount: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < 12; i++) {
    const calMonth = ((3 + i) % 12) + 1;
    const calYear = calMonth >= 4 ? startYear : startYear + 1;
    const mStart = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(calYear, calMonth, 0).getDate();
    const mEnd = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let amount = 0;
    for (const txn of txns) {
      if (txn.date >= mStart && txn.date <= mEnd) {
        amount += txn.amount;
      }
    }
    months.push({ month: `${monthNames[calMonth - 1]}`, amount });
  }

  // Average over months elapsed in FY (not just non-zero months)
  const now = new Date();
  const fyStartYear = parseInt(financialYear.split("-")[0]);
  let monthsElapsed: number;
  if (now.getFullYear() === fyStartYear) {
    monthsElapsed = now.getMonth() + 1 - 3; // Apr=1, May=2, ...
  } else {
    monthsElapsed = now.getMonth() + 1 + 9; // Jan=10, Feb=11, Mar=12
  }
  monthsElapsed = Math.max(1, Math.min(12, monthsElapsed));
  const totalSpent = months.reduce((s, m) => s + m.amount, 0);
  const average = totalSpent / monthsElapsed;

  // Category breakdown (roll up to direct linked categories)
  const catMap = new Map<number, number>();
  for (const txn of txns) {
    if (!txn.categoryId) continue;
    // Find the closest ancestor that's in the linked categoryIds
    let rollupId = txn.categoryId;
    let current = txn.categoryId;
    while (current) {
      if (categoryIds.includes(current)) { rollupId = current; break; }
      const parent = accountMap.get(current)?.parentId;
      if (!parent) break;
      current = parent;
    }
    catMap.set(rollupId, (catMap.get(rollupId) ?? 0) + txn.amount);
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([id, amount]) => {
      const acc = accountMap.get(id);
      return { name: acc?.name ?? "Unknown", amount, color: acc?.color ?? null };
    })
    .sort((a, b) => b.amount - a.amount);

  return { months, average, categoryBreakdown };
}

// ============================================================
// BUDGETS
// ============================================================

export async function getExpenseBudgets(financialYear: string): Promise<(ExpenseBudget & {
  categoryIds: number[];
  categoryNames: string[];
  spent: number;
})[]> {
  await assertAdminAccess();

  const budgets = db.select().from(expenseBudgets)
    .where(eq(expenseBudgets.financialYear, financialYear))
    .orderBy(expenseBudgets.name)
    .all() as ExpenseBudget[];

  const allLinks = db.select().from(expenseBudgetCategories).all();
  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  const now = new Date();
  const { start, end } = getMonthDateRange(now.getFullYear(), now.getMonth() + 1);

  const monthTxns = db.select().from(expenseTransactions)
    .where(and(
      eq(expenseTransactions.type, "expense"),
      sql`${expenseTransactions.date} >= ${start}`,
      sql`${expenseTransactions.date} <= ${end}`,
    ))
    .all();

  return budgets.map(budget => {
    const links = allLinks.filter(l => l.budgetId === budget.id);
    const categoryIds = links.map(l => l.categoryId);
    const categoryNames = categoryIds.map(id => accountMap.get(id)?.name ?? "Unknown");

    // Recursively expand to all descendants
    const allCategoryIds = new Set(categoryIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const acc of allAccounts) {
        if (acc.parentId && allCategoryIds.has(acc.parentId) && !allCategoryIds.has(acc.id)) {
          allCategoryIds.add(acc.id);
          changed = true;
        }
      }
    }

    const spent = monthTxns
      .filter(t => t.categoryId && allCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0);

    return { ...budget, categoryIds, categoryNames, spent };
  });
}

export async function createExpenseBudget(data: {
  name: string;
  monthlyAmount: number;
  financialYear: string;
  categoryIds: number[];
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();

  const result = db.insert(expenseBudgets).values({
    name: data.name,
    monthlyAmount: data.monthlyAmount,
    financialYear: data.financialYear,
  }).run();

  const budgetId = Number(result.lastInsertRowid);
  for (const categoryId of data.categoryIds) {
    db.insert(expenseBudgetCategories).values({ budgetId, categoryId }).run();
  }

  return { success: true, id: budgetId };
}

export async function updateExpenseBudget(id: number, data: {
  name: string;
  monthlyAmount: number;
  categoryIds: number[];
}): Promise<{ success: boolean }> {
  await assertAdminAccess();

  db.update(expenseBudgets).set({
    name: data.name,
    monthlyAmount: data.monthlyAmount,
  }).where(eq(expenseBudgets.id, id)).run();

  db.delete(expenseBudgetCategories).where(eq(expenseBudgetCategories.budgetId, id)).run();
  for (const categoryId of data.categoryIds) {
    db.insert(expenseBudgetCategories).values({ budgetId: id, categoryId }).run();
  }

  return { success: true };
}

export async function deleteExpenseBudget(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(expenseBudgetCategories).where(eq(expenseBudgetCategories.budgetId, id)).run();
  db.delete(expenseBudgets).where(eq(expenseBudgets.id, id)).run();
  return { success: true };
}

// ============================================================
// TARGETS
// ============================================================

export async function getExpenseTargets(financialYear: string): Promise<(ExpenseTarget & {
  accountIds: number[];
  accountNames: string[];
  thisMonthActual: number;
  fyAverage: number;
})[]> {
  await assertAdminAccess();

  const targets = db.select().from(expenseTargets)
    .where(eq(expenseTargets.financialYear, financialYear))
    .orderBy(expenseTargets.name)
    .all() as ExpenseTarget[];

  const allLinks = db.select().from(expenseTargetAccounts).all();
  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
  const { start: fyStart, end: fyEnd } = getFYDateRange(financialYear);

  const monthTransfers = db.select().from(expenseTransactions)
    .where(and(
      eq(expenseTransactions.type, "transfer"),
      sql`${expenseTransactions.date} >= ${monthStart}`,
      sql`${expenseTransactions.date} <= ${monthEnd}`,
    ))
    .all();

  const fyTransfers = db.select().from(expenseTransactions)
    .where(and(
      eq(expenseTransactions.type, "transfer"),
      sql`${expenseTransactions.date} >= ${fyStart}`,
      sql`${expenseTransactions.date} <= ${fyEnd}`,
    ))
    .all();

  const startYear = parseInt(financialYear.split("-")[0]);
  let monthsElapsed: number;
  if (now.getFullYear() === startYear) {
    monthsElapsed = now.getMonth() + 1 - 3;
  } else {
    monthsElapsed = now.getMonth() + 1 + 9;
  }
  monthsElapsed = Math.max(1, Math.min(12, monthsElapsed));

  return targets.map(target => {
    const links = allLinks.filter(l => l.targetId === target.id);
    const accountIds = links.map(l => l.accountId);
    const accountNames = accountIds.map(id => accountMap.get(id)?.name ?? "Unknown");

    // Recursively expand to all descendant accounts
    const allAccountIds = new Set(accountIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const acc of allAccounts) {
        if (acc.parentId && allAccountIds.has(acc.parentId) && !allAccountIds.has(acc.id)) {
          allAccountIds.add(acc.id);
          changed = true;
        }
      }
    }

    const thisMonthActual = monthTransfers
      .filter(t => t.toAccountId && allAccountIds.has(t.toAccountId))
      .reduce((sum, t) => sum + t.amount, 0);

    const fyTotal = fyTransfers
      .filter(t => t.toAccountId && allAccountIds.has(t.toAccountId))
      .reduce((sum, t) => sum + t.amount, 0);

    const fyAverage = fyTotal / monthsElapsed;

    return {
      ...target,
      accountIds,
      accountNames,
      thisMonthActual,
      fyAverage: Math.round(fyAverage),
    };
  });
}

export async function createExpenseTarget(data: {
  name: string;
  monthlyAmount: number;
  financialYear: string;
  accountIds: number[];
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db.insert(expenseTargets).values({
    name: data.name,
    monthlyAmount: data.monthlyAmount,
    financialYear: data.financialYear,
  }).run();

  const targetId = Number(result.lastInsertRowid);
  for (const accountId of data.accountIds) {
    db.insert(expenseTargetAccounts).values({ targetId, accountId }).run();
  }

  return { success: true, id: targetId };
}

export async function updateExpenseTarget(id: number, data: {
  name: string;
  monthlyAmount: number;
  accountIds: number[];
}): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.update(expenseTargets).set({
    name: data.name,
    monthlyAmount: data.monthlyAmount,
  }).where(eq(expenseTargets.id, id)).run();

  db.delete(expenseTargetAccounts).where(eq(expenseTargetAccounts.targetId, id)).run();
  for (const accountId of data.accountIds) {
    db.insert(expenseTargetAccounts).values({ targetId: id, accountId }).run();
  }

  return { success: true };
}

export async function deleteExpenseTarget(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(expenseTargetAccounts).where(eq(expenseTargetAccounts.targetId, id)).run();
  db.delete(expenseTargets).where(eq(expenseTargets.id, id)).run();
  return { success: true };
}

export async function getTargetMonthlyTrend(targetId: number, financialYear: string): Promise<{
  months: { month: string; amount: number }[];
  average: number;
  accountBreakdown: { name: string; amount: number; color: string | null }[];
}> {
  await assertAdminAccess();

  const allAccounts = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccounts.map(a => [a.id, a]));

  // Get target's linked account IDs
  const links = db.select().from(expenseTargetAccounts).where(eq(expenseTargetAccounts.targetId, targetId)).all();
  const accountIds = links.map(l => l.accountId);

  // Recursively expand to all descendants
  const allAccountIds = new Set(accountIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const acc of allAccounts) {
      if (acc.parentId && allAccountIds.has(acc.parentId) && !allAccountIds.has(acc.id)) {
        allAccountIds.add(acc.id);
        changed = true;
      }
    }
  }

  // Get all transfer transactions for the FY that go to these accounts
  const { start: fyStart, end: fyEnd } = getFYDateRange(financialYear);
  const txns = db.select().from(expenseTransactions)
    .where(and(
      eq(expenseTransactions.type, "transfer"),
      sql`${expenseTransactions.date} >= ${fyStart}`,
      sql`${expenseTransactions.date} <= ${fyEnd}`,
    ))
    .all()
    .filter(t => t.toAccountId && allAccountIds.has(t.toAccountId));

  // Build monthly trend (Apr → Mar)
  const startYear = parseInt(financialYear.split("-")[0]);
  const months: { month: string; amount: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < 12; i++) {
    const calMonth = ((3 + i) % 12) + 1;
    const calYear = calMonth >= 4 ? startYear : startYear + 1;
    const mStart = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(calYear, calMonth, 0).getDate();
    const mEnd = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let amount = 0;
    for (const txn of txns) {
      if (txn.date >= mStart && txn.date <= mEnd) {
        amount += txn.amount;
      }
    }
    months.push({ month: `${monthNames[calMonth - 1]}`, amount });
  }

  // Average over FY months elapsed
  const now = new Date();
  const fyStartYear = parseInt(financialYear.split("-")[0]);
  let monthsElapsed: number;
  if (now.getFullYear() === fyStartYear) {
    monthsElapsed = now.getMonth() + 1 - 3;
  } else {
    monthsElapsed = now.getMonth() + 1 + 9;
  }
  monthsElapsed = Math.max(1, Math.min(12, monthsElapsed));
  const totalTransferred = months.reduce((s, m) => s + m.amount, 0);
  const average = totalTransferred / monthsElapsed;

  // Account breakdown (roll up to linked accounts)
  const accMap = new Map<number, number>();
  for (const txn of txns) {
    if (!txn.toAccountId) continue;
    let rollupId = txn.toAccountId;
    let current = txn.toAccountId;
    while (current) {
      if (accountIds.includes(current)) { rollupId = current; break; }
      const parent = accountMap.get(current)?.parentId;
      if (!parent) break;
      current = parent;
    }
    accMap.set(rollupId, (accMap.get(rollupId) ?? 0) + txn.amount);
  }

  const accountBreakdown = Array.from(accMap.entries())
    .map(([id, amount]) => {
      const acc = accountMap.get(id);
      return { name: acc?.name ?? "Unknown", amount, color: acc?.color ?? null };
    })
    .sort((a, b) => b.amount - a.amount);

  return { months, average, accountBreakdown };
}

// ============================================================
// DRILL-DOWN
// ============================================================

export async function getAccountDrillDown(accountId: number, startDate: string, endDate: string): Promise<{
  account: ExpenseAccount | null;
  transactions: ExpenseTransaction[];
  monthlyTrend: { month: string; amount: number }[];
  totalAmount: number;
  subCategoryBreakdown: { id: number; name: string; amount: number; color: string | null }[];
}> {
  await assertAdminAccess();

  const account = db.select().from(expenseAccounts)
    .where(eq(expenseAccounts.id, accountId))
    .get() as ExpenseAccount | undefined ?? null;

  if (!account) return { account: null, transactions: [], monthlyTrend: [], totalAmount: 0, subCategoryBreakdown: [] };

  // Recursively get all descendant IDs
  const allAccsForDrillDown = db.select().from(expenseAccounts).all();
  const descendantIds = new Set([accountId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const acc of allAccsForDrillDown) {
      if (acc.parentId && descendantIds.has(acc.parentId) && !descendantIds.has(acc.id)) {
        descendantIds.add(acc.id);
        changed = true;
      }
    }
  }
  const allIds = Array.from(descendantIds);

  const allTxns = db.select().from(expenseTransactions)
    .where(and(
      sql`${expenseTransactions.date} >= ${startDate}`,
      sql`${expenseTransactions.date} <= ${endDate}`,
    ))
    .orderBy(desc(expenseTransactions.date))
    .all() as ExpenseTransaction[];

  const transactions = allTxns.filter(txn => {
    if (txn.categoryId && allIds.includes(txn.categoryId)) return true;
    if (txn.accountId && allIds.includes(txn.accountId)) return true;
    if (txn.fromAccountId && allIds.includes(txn.fromAccountId)) return true;
    if (txn.toAccountId && allIds.includes(txn.toAccountId)) return true;
    return false;
  });

  const allAccountsList = db.select().from(expenseAccounts).all();
  const accountMap = new Map(allAccountsList.map(a => [a.id, a.name]));

  const enriched = transactions.map(txn => ({
    ...txn,
    categoryName: txn.categoryId ? accountMap.get(txn.categoryId) ?? undefined : undefined,
    accountName: txn.accountId ? accountMap.get(txn.accountId) ?? undefined : undefined,
    fromAccountName: txn.fromAccountId ? accountMap.get(txn.fromAccountId) ?? undefined : undefined,
    toAccountName: txn.toAccountId ? accountMap.get(txn.toAccountId) ?? undefined : undefined,
  }));

  // Monthly trend (last 6 months)
  const now = new Date();
  const monthlyTrend: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const { start: mStart, end: mEnd } = getMonthDateRange(y, m);

    const monthAmount = allTxns
      .filter(txn => {
        if (txn.date < mStart || txn.date > mEnd) return false;
        if (txn.categoryId && allIds.includes(txn.categoryId)) return true;
        if (txn.toAccountId && allIds.includes(txn.toAccountId)) return true;
        return false;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    monthlyTrend.push({
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      amount: monthAmount,
    });
  }

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Sub-category breakdown: roll up each transaction to its direct child of this account
  const directChildren = allAccsForDrillDown.filter(a => a.parentId === accountId);
  const subCategoryBreakdown: { id: number; name: string; amount: number; color: string | null }[] = [];

  if (directChildren.length > 0) {
    const fullAccountMap = new Map(allAccsForDrillDown.map(a => [a.id, a]));

    // For each transaction, walk up to find which direct child it belongs to
    function getDirectChildAncestor(catId: number): number | null {
      let current = catId;
      while (current) {
        const acc = fullAccountMap.get(current);
        if (!acc) return null;
        if (acc.parentId === accountId) return current;
        if (!acc.parentId) return null;
        current = acc.parentId;
      }
      return null;
    }

    const childAmounts = new Map<number, number>();
    let selfAmount = 0;

    for (const txn of transactions) {
      const catId = txn.categoryId ?? txn.toAccountId;
      if (!catId) continue;
      if (catId === accountId) {
        selfAmount += txn.amount;
        continue;
      }
      const childId = getDirectChildAncestor(catId);
      if (childId) {
        childAmounts.set(childId, (childAmounts.get(childId) ?? 0) + txn.amount);
      }
    }

    // Add self amount if any transactions are directly on this account
    if (selfAmount > 0) {
      subCategoryBreakdown.push({ id: accountId, name: account.name + " (direct)", amount: selfAmount, color: null });
    }

    for (const child of directChildren) {
      const amount = childAmounts.get(child.id) ?? 0;
      if (amount > 0) {
        subCategoryBreakdown.push({ id: child.id, name: child.name, amount, color: child.color ?? null });
      }
    }

    subCategoryBreakdown.sort((a, b) => b.amount - a.amount);
  }

  return { account, transactions: enriched, monthlyTrend, totalAmount, subCategoryBreakdown };
}
