import { getBankStatementEntriesWithNames, getBankStatementStats } from "@/actions/bank-statements";
import { getExpenseAccounts } from "@/actions/expenses";
import { BankStatementsClient } from "@/components/bank-statements/bank-statements-client";
import { requirePageAccess } from "@/lib/auth";

interface Expenses2PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function Expenses2Page({ searchParams }: Expenses2PageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const now = new Date();
  const currentMonth = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  const currentYear = params.year ? parseInt(params.year, 10) : now.getFullYear();

  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const endDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [entries, accounts, stats] = await Promise.all([
    getBankStatementEntriesWithNames({ startDate, endDate }),
    getExpenseAccounts(),
    getBankStatementStats(startDate, endDate),
  ]);

  return (
    <BankStatementsClient
      entries={entries}
      accounts={accounts}
      stats={stats}
      currentMonth={currentMonth}
      currentYear={currentYear}
    />
  );
}
