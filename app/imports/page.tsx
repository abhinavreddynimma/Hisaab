import { requirePageAccess } from "@/lib/auth";
import {
  getStatementImports,
  getCanonicalTransactions,
} from "@/actions/statement-import";
import { getExpenseAccounts } from "@/actions/expenses";
import { ImportsPageClient } from "@/components/imports/imports-page-client";

interface ImportsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  await requirePageAccess();

  const params = await searchParams;

  const [imports, reviewTransactions, unmatchedTransactions, accounts] = await Promise.all([
    getStatementImports(),
    getCanonicalTransactions({ matchStatus: "review" }),
    getCanonicalTransactions({ matchStatus: "unmatched" }),
    getExpenseAccounts(),
  ]);

  return (
    <ImportsPageClient
      imports={imports}
      reviewTransactions={reviewTransactions}
      unmatchedTransactions={unmatchedTransactions}
      accounts={accounts}
      initialTab={params.tab}
    />
  );
}
