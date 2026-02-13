import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatForeignCurrency } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-3">
      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Total Earnings</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(stats.totalEarnings)}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">This Month</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(stats.thisMonthEarnings)}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          {stats.openInvoices > 0 ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Outstanding</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {stats.outstandingByCurrency.map((item, i) => (
                  <span key={item.currency}>
                    {i > 0 && <span className="text-base text-muted-foreground"> + </span>}
                    {formatForeignCurrency(item.amount, item.currency)}
                  </span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats.openInvoices} open invoice{stats.openInvoices !== 1 ? "s" : ""}
              </p>
            </>
          ) : stats.nextMonthProjection ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Next Month (est.)</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatCurrency(stats.nextMonthProjection.estimatedInr)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats.nextMonthProjection.workingDays} days · ₹{stats.nextMonthProjection.avgRate.toFixed(0)}/{getCurrencySymbol(stats.nextMonthProjection.currency)}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Outstanding</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatForeignCurrency(0, "EUR")}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                No open invoices
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
