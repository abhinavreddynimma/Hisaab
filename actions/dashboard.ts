"use server";

import { db } from "@/db";
import { invoices, dayEntries, clients, projects } from "@/db/schema";
import { eq, desc, sql, and, gte, lte, like } from "drizzle-orm";
import { getLeavePolicy, getDefaultProjectId } from "./settings";
import { getAllDayEntries, getDayEntriesForMonth } from "./day-entries";
import { calculateLeaveBalance, calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import { getEffectiveRate } from "./projects";
import { getFrenchHolidays } from "@/lib/constants";
import type { DashboardStats, DayEntry } from "@/lib/types";

export async function getDashboardStats(): Promise<DashboardStats> {
  // Total earnings from paid invoices (in INR)
  const paidInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(eq(invoices.status, "paid"))
    .all();
  const totalEarnings = paidInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // This month earnings (in INR) — based on when payment was received
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), like(invoices.paidDate, `${monthKey}%`)))
    .all();
  const thisMonthEarnings = thisMonthInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // Leave balance
  const policy = await getLeavePolicy();
  const allEntries = await getAllDayEntries();
  const leaveBalance = calculateLeaveBalance(policy, allEntries as DayEntry[]);

  // Open invoices (draft + sent)
  const openInvoiceCount = db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(sql`${invoices.status} IN ('draft', 'sent')`)
    .get();

  // Outstanding EUR (draft + sent totals)
  const openInvoices = db
    .select({ total: invoices.total })
    .from(invoices)
    .where(sql`${invoices.status} IN ('draft', 'sent')`)
    .all();
  const outstandingEur = openInvoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0);

  // Average payment delay (days between issue date and paid date)
  const paidWithDates = db
    .select({ issueDate: invoices.issueDate, paidDate: invoices.paidDate })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), sql`${invoices.paidDate} IS NOT NULL`))
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
      .where(and(eq(invoices.status, "paid"), sql`${invoices.eurToInrRate} IS NOT NULL`))
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

      // Next month's earnings from next month's working days
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth() + 1;
      const nextMonthEntries = await getDayEntriesForMonth(nextYear, nextMonth);
      const nextHolidays = getFrenchHolidays(nextYear);
      const augmented = withImplicitWorkingDays(nextMonthEntries as DayEntry[], nextYear, nextMonth, nextHolidays);
      const summary = calculateMonthSummary(augmented);

      const defaultProjectId = await getDefaultProjectId();
      const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
      const dailyRate = defaultProjectId ? await getEffectiveRate(defaultProjectId, nextMonthKey) : 0;

      const eurAmount = summary.effectiveWorkingDays * dailyRate;
      const grossInr = eurAmount * avgRate;
      const estimatedInr = grossInr * (1 - avgDeductionPct);

      nextMonthProjection = {
        estimatedInr: Math.round(estimatedInr),
        workingDays: summary.effectiveWorkingDays,
        avgRate: Math.round(avgRate * 100) / 100,
      };
    }
  }

  return {
    totalEarnings,
    thisMonthEarnings,
    leaveBalance,
    openInvoices: openCount,
    outstandingEur,
    avgPaymentDelay,
    nextMonthProjection,
  };
}

export async function getMonthlyEarningsData(months: number = 12): Promise<
  { month: string; earnings: number }[]
> {
  const result: { month: string; earnings: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const monthInvoices = db
      .select({ netInrAmount: invoices.netInrAmount })
      .from(invoices)
      .where(and(eq(invoices.status, "paid"), like(invoices.billingPeriodStart, `${monthKey}%`)))
      .all();

    const earnings = monthInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);
    result.push({ month: monthName, earnings });
  }

  return result;
}

export async function getClientEarningsData(): Promise<
  { name: string; value: number }[]
> {
  const allInvoices = db
    .select({
      clientName: clients.name,
      netInrAmount: invoices.netInrAmount,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.status, "paid"))
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
}> {
  const policy = await getLeavePolicy();
  const allEntries = await getAllDayEntries() as DayEntry[];

  const leaveBalance = calculateLeaveBalance(policy, allEntries);
  const totalExtraWorking = allEntries.filter((e) => e.dayType === "extra_working").length;
  const extraBalance = totalExtraWorking + leaveBalance;

  const [startYear, startMonth] = policy.trackingStartDate.split("-").map(Number);
  const now = new Date();
  let months = 0;
  let year = startYear;
  let month = startMonth;
  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
    months++;
    month++;
    if (month > 12) { month = 1; year++; }
  }

  const leavesAllowed = months * policy.leavesPerMonth;
  const leavesTaken = allEntries.filter((e) => e.dayType === "leave").length +
    allEntries.filter((e) => e.dayType === "half_day").length * 0.5;

  return { leaveBalance, totalExtraWorking, extraBalance, leavesAllowed, leavesTaken };
}

export async function getMonthlyExchangeRateData(months: number = 12): Promise<
  { month: string; rate: number }[]
> {
  const result: { month: string; rate: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthName = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const monthInvoices = db
      .select({ eurToInrRate: invoices.eurToInrRate, total: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.status, "paid"), like(invoices.billingPeriodStart, `${monthKey}%`)))
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
  const entries = await getAllDayEntries() as DayEntry[];
  const now = new Date();
  const holidays = new Map<string, string>();
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const yearHolidays = getFrenchHolidays(year);
    for (const [k, v] of yearHolidays) holidays.set(k, v);
  }
  return { entries, holidays: Array.from(holidays.entries()) };
}

export async function getLiveEurInrRate(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR", { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates?.INR ?? null;
  } catch {
    return null;
  }
}

export async function getRecentInvoices(limit: number = 5): Promise<
  { id: number; invoiceNumber: string; clientName: string; total: number; status: string; issueDate: string }[]
> {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      total: invoices.total,
      status: invoices.status,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .all();
}
