import { getExtraDaysPlannerData, seedDefaultExtraDayBuckets } from "@/actions/extra-days";
import { FYNavigator } from "@/components/dashboard/fy-navigator";
import { ExtraDaysPageClient } from "@/components/extra-days/extra-days-page-client";
import { requirePageAccess } from "@/lib/auth";
import { getCurrentFinancialYear } from "@/lib/constants";

interface ExtraDaysPageProps {
  searchParams: Promise<{ fy?: string }>;
}

export default async function ExtraDaysPage({ searchParams }: ExtraDaysPageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const fy = params.fy || getCurrentFinancialYear();

  await seedDefaultExtraDayBuckets();
  const plannerData = await getExtraDaysPlannerData(fy);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Extra Days Planner</h1>
        <FYNavigator financialYear={fy} basePath="/extra-days" />
      </div>
      <ExtraDaysPageClient data={plannerData} />
    </div>
  );
}
