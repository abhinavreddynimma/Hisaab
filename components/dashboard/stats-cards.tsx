import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatEuro } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
          <p className="text-3xl font-light tabular-nums tracking-tight">
            {formatCurrency(stats.totalEarnings)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-1">This Month</p>
          <p className="text-3xl font-light tabular-nums tracking-tight">
            {formatCurrency(stats.thisMonthEarnings)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {stats.openInvoices > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
              <p className="text-3xl font-light tabular-nums tracking-tight">
                {formatEuro(stats.outstandingEur)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.openInvoices} open invoice{stats.openInvoices !== 1 ? "s" : ""}
              </p>
            </>
          ) : stats.nextMonthProjection ? (
            <>
              <p className="text-sm text-muted-foreground mb-1">Next Month (est.)</p>
              <p className="text-3xl font-light tabular-nums tracking-tight">
                {formatCurrency(stats.nextMonthProjection.estimatedInr)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.nextMonthProjection.workingDays} days · ₹{stats.nextMonthProjection.avgRate.toFixed(0)}/€
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
              <p className="text-3xl font-light tabular-nums tracking-tight">
                {formatEuro(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No open invoices
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
