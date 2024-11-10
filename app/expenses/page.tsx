import { requirePageAccess } from "@/lib/auth";
import { getCurrentFinancialYear } from "@/lib/constants";
import {
  getExpenseAccounts,
  getExpenseAccountsGrouped,
  getExpenseTransactions,
  getExpenseStats,
  getExpenseBudgets,
  getExpenseTargets,
  seedDefaultAccounts,
} from "@/actions/expenses";
import { ExpensesPageClient } from "@/components/expenses/expenses-page-client";

interface ExpensesPageProps {
  searchParams: Promise<{ fy?: string; month?: string; year?: string; tab?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const fy = params.fy || getCurrentFinancialYear();

  // Auto-seed defaults on first visit
  await seedDefaultAccounts();

  const now = new Date();
  const currentMonth = params.month ? parseInt(params.month) : now.getMonth() + 1;
  const currentYear = params.year ? parseInt(params.year) : now.getFullYear();

  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const endDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [accounts, accountsGrouped, transactions, stats, budgets, targets] = await Promise.all([
    getExpenseAccounts(),
    getExpenseAccountsGrouped(),
    getExpenseTransactions({ startDate, endDate }),
    getExpenseStats(startDate, endDate),
    getExpenseBudgets(fy),
    getExpenseTargets(fy),
  ]);

  return (
    <ExpensesPageClient
      accounts={accounts}
      accountsGrouped={accountsGrouped}
      transactions={transactions}
      stats={stats}
      budgets={budgets}
      targets={targets}
      currentMonth={currentMonth}
      currentYear={currentYear}
      financialYear={fy}
      initialTab={params.tab}
    />
  );
}
