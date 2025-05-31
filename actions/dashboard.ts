"use server";

import { db } from "@/db";
import { invoices, dayEntries, clients, projects, projectRates } from "@/db/schema";
import { eq, desc, sql, and, like } from "drizzle-orm";
import { getLeavePolicy, getDefaultProjectId } from "./settings";
import { calculateLeaveBalance, calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import { getFrenchHolidays } from "@/lib/constants";
import type { DashboardStats, DayEntry } from "@/lib/types";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getCurrentMonthWindow(now: Date = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  return {
    year,
    month,
    monthStartStr: toDateString(monthStart),
    monthEndStr: toDateString(monthEnd),
  };
}

function getAllDayEntriesInternal(): DayEntry[] {
  return db.select().from(dayEntries).orderBy(dayEntries.date).all() as DayEntry[];
}

function getDayEntriesForMonthInternal(year: number, month: number): DayEntry[] {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return db
    .select()
    .from(dayEntries)
    .where(like(dayEntries.date, `${monthKey}%`))
    .orderBy(dayEntries.date)
    .all() as DayEntry[];
}

function getEffectiveRateInternal(projectId: number, monthKey: string): number {
  const override = db
    .select({ dailyRate: projectRates.dailyRate })
    .from(projectRates)
    .where(and(eq(projectRates.projectId, projectId), eq(projectRates.monthKey, monthKey)))
    .get();
  if (override?.dailyRate != null) return override.dailyRate;

  const project = db
    .select({ defaultDailyRate: projects.defaultDailyRate })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  return project?.defaultDailyRate ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await assertAuthenticatedAccess();
  const { year: currentYear, month: currentMonth, monthStartStr, monthEndStr } = getCurrentMonthWindow();

  // Total earnings from paid invoices (in INR), capped at current month-end
  const paidInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} IS NOT NULL`,
        sql`${invoices.paidDate} <= ${monthEndStr}`,
      ),
    )
    .all();
  const totalEarnings = paidInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // This month earnings (in INR), based on payment date within current month
  const thisMonthInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} IS NOT NULL`,
        sql`${invoices.paidDate} >= ${monthStartStr}`,
        sql`${invoices.paidDate} <= ${monthEndStr}`,
      ),
    )
    .all();
  const thisMonthEarnings = thisMonthInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // Leave balance, capped at current month-end
  const policy = await getLeavePolicy();
  const allEntries = getAllDayEntriesInternal();
  const dayEntriesUpToMonthEnd = allEntries.filter((entry) => entry.date <= monthEndStr);
  const leaveBalance = calculateLeaveBalance(policy, dayEntriesUpToMonthEnd, currentYear, currentMonth);

  // Open invoices (draft + sent), capped at current month-end by issue date
  const openInvoiceCount = db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(and(sql`${invoices.status} IN ('draft', 'sent')`, sql`${invoices.issueDate} <= ${monthEndStr}`))
    .get();

  // Outstanding by currency (draft + sent totals), capped at current month-end by issue date
  const openInvoiceRows = db
    .select({ total: invoices.total, currency: invoices.currency })
    .from(invoices)
    .where(and(sql`${invoices.status} IN ('draft', 'sent')`, sql`${invoices.issueDate} <= ${monthEndStr}`))
    .all();
  const outstandingMap = new Map<string, number>();
  for (const inv of openInvoiceRows) {
    const cur = inv.currency ?? "EUR";
    outstandingMap.set(cur, (outstandingMap.get(cur) ?? 0) + (inv.total ?? 0));
  }
  const outstandingByCurrency = Array.from(outstandingMap.entries()).map(
    ([currency, amount]) => ({ currency, amount })
  );

  // Average payment delay (days between issue date and paid date)
  const paidWithDates = db
    .select({ issueDate: invoices.issueDate, paidDate: invoices.paidDate })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} IS NOT NULL`,
        sql`${invoices.paidDate} <= ${monthEndStr}`,
      ),
    )
    .all();
  let avgPaymentDelay: number | null = null;
  if (paidWithDates.length > 0) {
    const totalDays = paidWithDates.reduce((sum, inv) => {
      const issue = new Date(inv.issueDate);
      const paid = new Date(inv.paidDate!);
      return sum + Math.max(0, Math.round((paid.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24)));
    }, 0);
    avgPaymentDelay = Math.round(totalDays / paidWithDates.length);
  }

  // Next month projection (when no open invoices)
  let nextMonthProjection: DashboardStats["nextMonthProjection"] = null;
  const openCount = openInvoiceCount?.count ?? 0;
  if (openCount === 0) {
    // Average EUR-INR rate and average deductions from paid invoices
    const paidFull = db
      .select({
        total: invoices.total,
        eurToInrRate: invoices.eurToInrRate,
        platformCharges: invoices.platformCharges,
        bankCharges: invoices.bankCharges,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          sql`${invoices.eurToInrRate} IS NOT NULL`,
          sql`${invoices.paidDate} IS NOT NULL`,
          sql`${invoices.paidDate} <= ${monthEndStr}`,
        ),
      )
      .all();

    if (paidFull.length > 0) {
      const totalEur = paidFull.reduce((s, i) => s + (i.total ?? 0), 0);
      const avgRate = totalEur > 0
        ? paidFull.reduce((s, i) => s + (i.eurToInrRate ?? 0) * (i.total ?? 0), 0) / totalEur
        : 0;
      const avgDeductionPct = totalEur > 0
        ? paidFull.reduce((s, i) => s + ((i.platformCharges ?? 0) + (i.bankCharges ?? 0)), 0) /
          (totalEur * avgRate)
        : 0;

      // Next month's earnings based on this month's working days
      // (invoice for current month gets paid next month)
      const currentMonthEntries = getDayEntriesForMonthInternal(currentYear, currentMonth);
      const currentHolidays = getFrenchHolidays(currentYear);
      const augmented = withImplicitWorkingDays(currentMonthEntries as DayEntry[], currentYear, currentMonth, currentHolidays);
      const summary = calculateMonthSummary(augmented);

      const defaultProjectId = await getDefaultProjectId();
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
      const dailyRate = defaultProjectId ? getEffectiveRateInternal(defaultProjectId, currentMonthKey) : 0;

      // Get the default project's currency
      let projectCurrency = "EUR";
      if (defaultProjectId) {
        const proj = db
          .select({ currency: projects.currency })
          .from(projects)
          .where(eq(projects.id, defaultProjectId))
          .get();
        if (proj?.currency) projectCurrency = proj.currency;
      }

      const foreignAmount = summary.effectiveWorkingDays * dailyRate;
      const grossInr = foreignAmount * avgRate;
      const estimatedInr = grossInr * (1 - avgDeductionPct);

      nextMonthProjection = {
        estimatedInr: Math.round(estimatedInr),
        workingDays: summary.effectiveWorkingDays,
        avgRate: Math.round(avgRate * 100) / 100,
        currency: projectCurrency,
      };
    }
  }

  return {
    totalEarnings,
    thisMonthEarnings,
    leaveBalance,
    openInvoices: openCount,
    outstandingByCurrency,
    avgPaymentDelay,
    nextMonthProjection,
  };
}

export async function getMonthlyEarningsData(months: number = 12): Promise<
  { month: string; earnings: number }[]
> {
  await assertAdminAccess();
  const result: { month: string; earnings: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const monthInvoices = db
      .select({ netInrAmount: invoices.netInrAmount })
      .from(invoices)
      .where(and(eq(invoices.status, "paid"), like(invoices.paidDate, `${monthKey}%`)))
      .all();

    const earnings = monthInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);
    result.push({ month: monthName, earnings });
  }

  return result;
}

export async function getClientEarningsData(): Promise<
  { name: string; value: number }[]
> {
  await assertAdminAccess();
  const { monthEndStr } = getCurrentMonthWindow();
  const allInvoices = db
    .select({
      clientName: clients.name,
      netInrAmount: invoices.netInrAmount,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} IS NOT NULL`,
        sql`${invoices.paidDate} <= ${monthEndStr}`,
      ),
    )
    .all();

  const clientMap = new Map<string, number>();
  for (const inv of allInvoices) {
    const current = clientMap.get(inv.clientName) ?? 0;
    clientMap.set(inv.clientName, current + (inv.netInrAmount ?? 0));
  }

  return Array.from(clientMap.entries()).map(([name, value]) => ({ name, value }));
}

export async function getMonthlyBreakdownData(months: number = 6): Promise<
  { month: string; working: number; leaves: number; extraWorking: number; halfDays: number }[]
> {
  await assertAdminAccess();
  const result: { month: string; working: number; leaves: number; extraWorking: number; halfDays: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-IN", { month: "short" });

    const rawEntries = db
      .select()
      .from(dayEntries)
      .where(like(dayEntries.date, `${monthKey}%`))
      .all() as DayEntry[];

    const holidays = getFrenchHolidays(year);
    const entries = withImplicitWorkingDays(rawEntries, year, month, holidays);
    const summary = calculateMonthSummary(entries);

    result.push({
      month: monthName,
      working: summary.workingDays,
      leaves: summary.leaves,
      extraWorking: summary.extraWorkingDays,
      halfDays: summary.halfDays,
    });
  }

  return result;
}

export async function getBalanceData(): Promise<{
  leaveBalance: number;
  totalExtraWorking: number;
  extraBalance: number;
  leavesAllowed: number;
  leavesTaken: number;
  annualDaysOffTarget: number;
  totalDaysOffToDate: number;
  expectedDaysOffToDate: number;
  burnoutRiskThreshold: number;
  leavesTakenToDate: number;
  publicHolidaysOffToDate: number;
  daysOffStatus: "burnout_risk" | "on_track" | "above_target";
}> {
  await assertAdminAccess();
  const policy = await getLeavePolicy();
  const allEntries = getAllDayEntriesInternal();
  const { year: currentYear, month: currentMonth, monthEndStr } = getCurrentMonthWindow();
  const entriesUpToMonthEnd = allEntries.filter((entry) => entry.date <= monthEndStr);

  const leaveBalance = calculateLeaveBalance(policy, entriesUpToMonthEnd, currentYear, currentMonth);
  const totalExtraWorking = entriesUpToMonthEnd.filter((e) => e.dayType === "extra_working").length;
  const extraBalance = totalExtraWorking + leaveBalance;

  const [startYear, startMonth] = policy.trackingStartDate.split("-").map(Number);
  let months = 0;
  let year = startYear;
  let month = startMonth;
  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    months++;
    month++;
    if (month > 12) { month = 1; year++; }
  }

  const leavesAllowed = months * policy.leavesPerMonth;
  const leavesTaken = entriesUpToMonthEnd.filter((e) => e.dayType === "leave").length +
    entriesUpToMonthEnd.filter((e) => e.dayType === "half_day").length * 0.5;

  const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyEndYear = fyStartYear + 1;
  const fyStart = `${fyStartYear}-04-01`;
  const fyEnd = `${fyEndYear}-03-31`;
  const periodEnd = monthEndStr < fyEnd ? monthEndStr : fyEnd;
  const fyEntries = entriesUpToMonthEnd.filter((e) => e.date >= fyStart && e.date <= periodEnd);

  const leavesTakenToDate = fyEntries.reduce((sum, entry) => {
    if (entry.dayType === "leave") return sum + 1;
    if (entry.dayType === "half_day") return sum + 0.5;
    return sum;
  }, 0);

  const entryByDate = new Map(fyEntries.map((entry) => [entry.date, entry.dayType]));
  const workedTypes = new Set(["working", "extra_working", "half_day"]);
  const holidayDates = [
    ...Array.from(getFrenchHolidays(fyStartYear).keys()),
    ...Array.from(getFrenchHolidays(fyEndYear).keys()),
  ];
  const publicHolidaysOffToDate = holidayDates.reduce((sum, dateStr) => {
    if (dateStr < fyStart || dateStr > periodEnd) return sum;

    const dateObj = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return sum;

    const dayType = entryByDate.get(dateStr);
    if (dayType && workedTypes.has(dayType)) return sum;
    return sum + 1;
  }, 0);

  const totalDaysOffToDate = leavesTakenToDate + publicHolidaysOffToDate;
  const fyStartUtc = Date.UTC(fyStartYear, 3, 1);
  const fyEndUtc = Date.UTC(fyEndYear, 2, 31);
  const periodEndDate = new Date(`${periodEnd}T00:00:00`);
  const periodEndUtc = Date.UTC(periodEndDate.getFullYear(), periodEndDate.getMonth(), periodEndDate.getDate());
  const elapsedDays = Math.floor((periodEndUtc - fyStartUtc) / (1000 * 60 * 60 * 24)) + 1;
  const daysInFy = Math.floor((fyEndUtc - fyStartUtc) / (1000 * 60 * 60 * 24)) + 1;
  const elapsedFraction = Math.min(1, elapsedDays / daysInFy);

  const expectedDaysOffToDate = policy.annualDaysOffTarget * elapsedFraction;
  const burnoutRiskThreshold = expectedDaysOffToDate * 0.75;

  const daysOffStatus: "burnout_risk" | "on_track" | "above_target" =
    totalDaysOffToDate < burnoutRiskThreshold
      ? "burnout_risk"
      : totalDaysOffToDate > expectedDaysOffToDate
        ? "above_target"
        : "on_track";

  return {
    leaveBalance,
    totalExtraWorking,
    extraBalance,
    leavesAllowed,
    leavesTaken,
    annualDaysOffTarget: policy.annualDaysOffTarget,
    totalDaysOffToDate,
    expectedDaysOffToDate,
    burnoutRiskThreshold,
    leavesTakenToDate,
    publicHolidaysOffToDate,
    daysOffStatus,
  };
}

export async function getPrimaryCurrency(): Promise<string> {
  await assertAdminAccess();
  const { monthEndStr } = getCurrentMonthWindow();
  // Determine the most-used currency across paid invoices, fallback to default project
  const currencies = db
    .select({ currency: invoices.currency, count: sql<number>`count(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} IS NOT NULL`,
        sql`${invoices.paidDate} <= ${monthEndStr}`,
      ),
    )
    .groupBy(invoices.currency)
    .orderBy(sql`count(*) DESC`)
    .limit(1)
    .all();
  if (currencies.length > 0 && currencies[0].currency) {
    return currencies[0].currency;
  }
  // Fallback: default project currency
  const defaultProjectId = await getDefaultProjectId();
  if (defaultProjectId) {
    const proj = db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, defaultProjectId))
      .get();
    if (proj?.currency) return proj.currency;
  }
  return "EUR";
}

export async function getMonthlyExchangeRateData(months: number = 12): Promise<
  { month: string; rate: number }[]
> {
  await assertAdminAccess();
  const { monthEndStr } = getCurrentMonthWindow();
  const result: { month: string; rate: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const monthInvoices = db
      .select({ eurToInrRate: invoices.eurToInrRate, total: invoices.total })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "paid"),
          like(invoices.billingPeriodStart, `${monthKey}%`),
          sql`${invoices.paidDate} IS NOT NULL`,
          sql`${invoices.paidDate} <= ${monthEndStr}`,
        ),
      )
      .all();

    // Weighted average by invoice total
    const totalEur = monthInvoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
    const weightedRate = totalEur > 0
      ? monthInvoices.reduce((sum, inv) => sum + (inv.eurToInrRate ?? 0) * (inv.total ?? 0), 0) / totalEur
      : 0;

    result.push({ month: monthName, rate: Math.round(weightedRate * 100) / 100 });
  }

  return result;
}

export async function getCalendarOverviewData(): Promise<{
  entries: DayEntry[];
  holidays: [string, string][];
}> {
  await assertAdminAccess();
  const entries = getAllDayEntriesInternal();
  const now = new Date();
  const holidays = new Map<string, string>();
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const yearHolidays = getFrenchHolidays(year);
    for (const [k, v] of yearHolidays) holidays.set(k, v);
  }
  return { entries, holidays: Array.from(holidays.entries()) };
}

export async function getLiveRate(currency: string = "EUR"): Promise<number | null> {
  await assertAdminAccess();
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates?.INR ?? null;
  } catch {
    return null;
  }
}

export async function getRecentInvoices(limit: number = 5): Promise<
  { id: number; invoiceNumber: string; clientName: string; total: number; currency: string; status: string; issueDate: string }[]
> {
  await assertAuthenticatedAccess();
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      total: invoices.total,
      currency: invoices.currency,
      status: invoices.status,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .all();
}
