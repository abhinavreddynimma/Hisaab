import { requirePageAccess } from "@/lib/auth";
import { getCurrentFinancialYear } from "@/lib/constants";
import {
  getExpenseAccounts,
  getExpenseAccountsGrouped,
  getExpenseTransactions,
  getExpenseStats,
  getExpenseBudgets,
  getExpenseTargets,
  getExpenseFYOverview,
  getExpenseCumulativeBalance,
  seedDefaultAccounts,
  resetExpenseData,
} from "@/actions/expenses";
import { getFYDateRange } from "@/lib/constants";
import { ExpensesPageClient } from "@/components/expenses/expenses-page-client";
import { syncAllInvoicesToExpenses } from "@/actions/invoice-expense-sync";
import { syncRecurringForMonth, getRecurringExpenses } from "@/actions/recurring-expenses";
import { syncAllTaxPaymentsToExpenses } from "@/actions/tax-expense-sync";

interface ExpensesPageProps {
  searchParams: Promise<{ fy?: string; month?: string; year?: string; tab?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const fy = params.fy || getCurrentFinancialYear();

  // Migration v2 is complete — no more auto-reset needed

  // Auto-seed defaults on first visit
  await seedDefaultAccounts();

  // Sync invoices and tax payments to expense transactions (idempotent)
  await syncAllInvoicesToExpenses();
  await syncAllTaxPaymentsToExpenses();

  const now = new Date();
  const currentMonth = params.month ? parseInt(params.month) : now.getMonth() + 1;
  const currentYear = params.year ? parseInt(params.year) : now.getFullYear();

  // Sync recurring expenses for current viewed month
  await syncRecurringForMonth(currentYear, currentMonth);

  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const endDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { start: fyStart, end: fyEnd } = getFYDateRange(fy);

  const [accounts, accountsGrouped, transactions, stats, budgets, targets, recurringExpenses, fyStats, fyOverview, monthlyBalance, fyBalance] = await Promise.all([
    getExpenseAccounts(),
    getExpenseAccountsGrouped(),
    getExpenseTransactions({ startDate, endDate }),
    getExpenseStats(startDate, endDate),
    getExpenseBudgets(fy),
    getExpenseTargets(fy),
    getRecurringExpenses(),
    getExpenseStats(fyStart, fyEnd),
    getExpenseFYOverview(fy),
    getExpenseCumulativeBalance(endDate),
    getExpenseCumulativeBalance(fyEnd),
  ]);

  return (
    <ExpensesPageClient
      accounts={accounts}
      accountsGrouped={accountsGrouped}
      transactions={transactions}
      stats={{ ...stats, balance: monthlyBalance }}
      budgets={budgets}
      targets={targets}
      recurringExpenses={recurringExpenses}
      fyStats={{ ...fyStats, balance: fyBalance }}
      fyOverview={fyOverview}
      currentMonth={currentMonth}
      currentYear={currentYear}
      financialYear={fy}
      initialTab={params.tab}
    />
  );
}
