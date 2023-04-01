import {
  getDashboardStats,
  getMonthlyEarningsData,
  getClientEarningsData,
  getMonthlyBreakdownData,
  getBalanceData,
  getRecentInvoices,
  getMonthlyExchangeRateData,
  getCalendarOverviewData,
  getLiveEurInrRate,
} from "@/actions/dashboard";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { EarningsChart } from "@/components/dashboard/earnings-chart";
import { ClientBreakdownChart } from "@/components/dashboard/client-breakdown-chart";
import { BalanceOverview } from "@/components/dashboard/balance-overview";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { ExchangeRateChart } from "@/components/dashboard/exchange-rate-chart";
import { CalendarOverview } from "@/components/dashboard/calendar-overview";

export default async function DashboardPage() {
  const [stats, monthlyEarnings, clientEarnings, monthlyBreakdown, balanceData, recentInvoices, exchangeRates, calendarData, liveRate] =
    await Promise.all([
      getDashboardStats(),
      getMonthlyEarningsData(),
      getClientEarningsData(),
      getMonthlyBreakdownData(),
      getBalanceData(),
      getRecentInvoices(),
      getMonthlyExchangeRateData(),
      getCalendarOverviewData(),
      getLiveEurInrRate(),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <StatsCards stats={stats} />

      <CalendarOverview entries={calendarData.entries} holidays={calendarData.holidays} />

      <BalanceOverview balanceData={balanceData} monthlyData={monthlyBreakdown} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EarningsChart data={monthlyEarnings} />
        <ClientBreakdownChart data={clientEarnings} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentInvoices invoices={recentInvoices} />
        <ExchangeRateChart data={exchangeRates} liveRate={liveRate} />
      </div>
    </div>
  );
}
