"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { taxPayments, taxPaymentAttachments, invoices } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { TaxPayment, TaxPaymentAttachment, TaxQuarter, DayEntry } from "@/lib/types";
import { getDayEntriesForMonth } from "./day-entries";
import { getDefaultProjectId } from "./settings";
import { getProject, getProjectRateTimeline } from "./projects";
import { calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import { syncTaxPaymentToExpense, removeTaxPaymentExpenseLink } from "./tax-expense-sync";
import { getFrenchHolidays, TAX_QUARTERS, PRESUMPTIVE_LIMIT_44ADA, is44AdaEligible, getCurrentFinancialYear } from "@/lib/constants";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export type TaxProjectionMode = "invoice" | "calendar";

type ProjectionCalendarBreakdown = {
  weekdayWorkingDays: number;
  publicHolidayWorkingDays: number;
  weekendWorkingDays: number;
};

export async function getTaxPayments(financialYear?: string): Promise<TaxPayment[]> {
  await assertAdminAccess();
  if (financialYear) {
    return db
      .select()
      .from(taxPayments)
      .where(eq(taxPayments.financialYear, financialYear))
      .orderBy(desc(taxPayments.paymentDate))
      .all() as TaxPayment[];
  }
  return db
    .select()
    .from(taxPayments)
    .orderBy(desc(taxPayments.paymentDate))
    .all() as TaxPayment[];
}

export async function getTaxPayment(id: number): Promise<TaxPayment | null> {
  await assertAdminAccess();
  const result = db
    .select()
    .from(taxPayments)
    .where(eq(taxPayments.id, id))
    .get() as TaxPayment | undefined;
  return result ?? null;
}

export async function createTaxPayment(data: {
  financialYear: string;
  quarter: TaxQuarter;
  amount: number;
  paymentDate: string;
  challanNo?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(taxPayments)
    .values({
      financialYear: data.financialYear,
      quarter: data.quarter,
      amount: data.amount,
      paymentDate: data.paymentDate,
      challanNo: data.challanNo || null,
      notes: data.notes || null,
    })
    .run();
  const id = Number(result.lastInsertRowid);
  await syncTaxPaymentToExpense(id);
  revalidatePath("/tax");
  revalidatePath("/dashboard");
  return { success: true, id };
}

export async function updateTaxPayment(
  id: number,
  data: {
    financialYear: string;
    quarter: TaxQuarter;
    amount: number;
    paymentDate: string;
    challanNo?: string;
    notes?: string;
  }
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.update(taxPayments)
    .set({
      financialYear: data.financialYear,
      quarter: data.quarter,
      amount: data.amount,
      paymentDate: data.paymentDate,
      challanNo: data.challanNo || null,
      notes: data.notes || null,
    })
    .where(eq(taxPayments.id, id))
    .run();
  await syncTaxPaymentToExpense(id);
  revalidatePath("/tax");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTaxPayment(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();

  // Cascade-delete attachments from disk and DB
  const attachments = db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.taxPaymentId, id))
    .all();

  for (const att of attachments) {
    const filePath = path.join(process.cwd(), "data", "attachments", att.fileName);
    try { await unlink(filePath); } catch { /* file may be gone */ }
  }
  db.delete(taxPaymentAttachments).where(eq(taxPaymentAttachments.taxPaymentId, id)).run();

  await removeTaxPaymentExpenseLink(id);
  db.delete(taxPayments).where(eq(taxPayments.id, id)).run();
  revalidatePath("/tax");
  revalidatePath("/dashboard");
  return { success: true };
}

// New Tax Regime slabs for FY 2025-26
const NEW_REGIME_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.10 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.20 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

function calculateIncomeTax(taxableIncome: number): { slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[]; totalTax: number } {
  const slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[] = [];
  let remaining = taxableIncome;
  let prev = 0;
  let totalTax = 0;

  for (const { upTo, rate } of NEW_REGIME_SLABS) {
    if (remaining <= 0) break;
    const slabWidth = upTo === Infinity ? remaining : upTo - prev;
    const taxable = Math.min(remaining, slabWidth);
    const tax = taxable * rate;
    const slabLabel = upTo === Infinity ? `Above ₹${(prev / 100000).toFixed(0)}L` : `₹${(prev / 100000).toFixed(0)}L – ₹${(upTo / 100000).toFixed(0)}L`;
    slabBreakdown.push({ slab: slabLabel, taxable, rate, tax });
    totalTax += tax;
    remaining -= taxable;
    prev = upTo;
  }

  return { slabBreakdown, totalTax };
}

export async function getTaxComputation(financialYear: string): Promise<{
  grossReceipts: number;
  presumptiveIncome: number;
  taxableIncome: number;
  slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[];
  incomeTax: number;
  rebate87A: number;
  cess: number;
  totalTaxLiability: number;
  totalPaid: number;
  balance: number;
}> {
  await assertAdminAccess();
  // FY "2025-26" → April 2025 to March 2026
  const [startYear] = financialYear.split("-").map(Number);
  const fyStart = `${startYear}-04-01`;
  const fyEnd = `${startYear + 1}-03-31`;

  // Get all paid invoices whose paidDate falls within the FY
  const paidInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} >= ${fyStart}`,
        sql`${invoices.paidDate} <= ${fyEnd}`,
      )
    )
    .all();

  const grossReceipts = paidInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // Section 44ADA: presumptive income = 50% of gross receipts, available only up
  // to ₹75 lakh. Above that, 44ADA does not apply and tax is computed on full
  // gross receipts (no standard deduction available for self-employed) — this is
  // the worst-case estimate; actual business profit may be lower if expenses are
  // deducted under regular books of account.
  const presumptiveIncome = grossReceipts * 0.5;
  const taxableIncome = Math.max(0, is44AdaEligible(grossReceipts) ? presumptiveIncome : grossReceipts);

  // Calculate tax
  const { slabBreakdown, totalTax: incomeTax } = calculateIncomeTax(taxableIncome);

  // Rebate u/s 87A: up to ₹60,000 if taxable income ≤ ₹12L (new regime FY 2025-26)
  const rebate87A = taxableIncome <= 1200000 ? Math.min(incomeTax, 60000) : 0;
  const taxAfterRebate = incomeTax - rebate87A;

  // 4% Health & Education Cess
  const cess = taxAfterRebate * 0.04;
  const totalTaxLiability = taxAfterRebate + cess;

  // Total advance tax paid
  const summary = await getTaxSummaryForFY(financialYear);
  const totalPaid = summary.total;
  const balance = totalTaxLiability - totalPaid;

  return {
    grossReceipts,
    presumptiveIncome,
    taxableIncome,
    slabBreakdown,
    incomeTax,
    rebate87A,
    cess,
    totalTaxLiability,
    totalPaid,
    balance,
  };
}

export async function getTaxProjection(
  financialYear: string,
  mode: TaxProjectionMode = "invoice",
  deferMarch: boolean = false,
): Promise<{
  monthlyBreakdown: {
    month: string;
    actual: number;
    projected: boolean;
    workingDays?: number;
    leaves?: number;
    invoiceBased?: boolean;
    rate?: number;
    calendarBreakdown?: ProjectionCalendarBreakdown;
  }[];
  monthsElapsed: number;
  monthsRemaining: number;
  avgRate: number;
  mode: TaxProjectionMode;
  modeSummary: string;
  rateSourceLabel: string;
  projectedGrossReceipts: number;
  projectedPresumptiveIncome: number;
  projectedTaxableIncome: number;
  slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[];
  projectedIncomeTax: number;
  projectedRebate87A: number;
  projectedCess: number;
  projectedTotalTax: number;
  totalPaid: number;
  projectedBalance: number;
  advanceTaxBasis: { grossReceipts: number; totalTax: number; isAssumed: boolean };
  advanceTaxSchedule: {
    quarter: TaxQuarter;
    label: string;
    dueDate: string;
    cumulativePct: number;
    cumulativeDue: number;
    installment: number;
    cumulativePaid: number;
    balance: number;
    status: "paid" | "upcoming" | "overdue";
  }[];
  yearlyDayTotals: {
    workingDays: number;
    extraWorkingDays: number;
    halfDays: number;
    leaves: number;
    holidays: number;
    effectiveWorkingDays: number;
  };
  yearlyCalendarBreakdown: {
    weekdayWorkingDays: number;
    publicHolidayWorkingDays: number;
    weekendWorkingDays: number;
  };
  marchInvoices: {
    id: number;
    invoiceNumber: string;
    issueDate: string;
    netInrAmount: number | null;
    total: number | null;
    status: string;
  }[];
  marchDeferralAmount: number;
  marchDeferralTaxSavings: number;
  deferMarch: boolean;
}> {
  await assertAdminAccess();
  const [startYear] = financialYear.split("-").map(Number);
  const fyStart = `${startYear}-04-01`;
  const fyEnd = `${startYear + 1}-03-31`;

  // Get all paid invoices in the FY
  const paidInvoices = db
    .select({
      netInrAmount: invoices.netInrAmount,
      paidDate: invoices.paidDate,
      billingPeriodStart: invoices.billingPeriodStart,
      total: invoices.total,
      eurToInrRate: invoices.eurToInrRate,
      platformCharges: invoices.platformCharges,
      bankCharges: invoices.bankCharges,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} >= ${fyStart}`,
        sql`${invoices.paidDate} <= ${fyEnd}`,
      )
    )
    .all();

  const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

  // Determine elapsed months
  const now = new Date();
  let currentIdx: number;
  if (now.getFullYear() === startYear) {
    currentIdx = now.getMonth() - 3;
  } else {
    currentIdx = now.getMonth() + 9;
  }
  // Don't count the current month as elapsed — it's still in progress
  // and we likely haven't received payment yet, so project it instead.
  const monthsElapsed = Math.min(12, Math.max(0, currentIdx));
  const monthsRemaining = 12 - monthsElapsed;

  const defaultProjectId = await getDefaultProjectId();
  let projectCurrency = "EUR";
  let defaultProjectFallbackRate = 0;
  // Pre-fetch the project rate timeline ONCE — the per-month loop below would
  // otherwise issue 12+ queries (one per month + one for the project lookup).
  let rateTimeline: { monthKey: string; dailyRate: number }[] = [];
  if (defaultProjectId) {
    const project = await getProject(defaultProjectId);
    if (project?.currency) projectCurrency = project.currency;
    defaultProjectFallbackRate = project?.defaultDailyRate ?? 0;
    const timeline = await getProjectRateTimeline(defaultProjectId);
    rateTimeline = timeline
      .map((r) => ({ monthKey: r.monthKey, dailyRate: r.dailyRate }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  // Resolve the daily rate for a given month from the pre-fetched timeline:
  // latest entry whose monthKey <= lookupKey, else fall back to project default.
  function dailyRateForMonth(monthKey: string): number {
    let selected = defaultProjectFallbackRate;
    for (const point of rateTimeline) {
      if (point.monthKey <= monthKey) selected = point.dailyRate;
      else break;
    }
    return selected;
  }

  // Prefer the live FX rate (same source the dashboard uses), falling back to the
  // most recent paid invoice's FX rate, then to a static EUR-INR fallback.
  let currentRate = 0;
  let rateSourceLabel = "No FX data";
  if (projectCurrency === "INR") {
    currentRate = 1;
    rateSourceLabel = "Using INR project rate";
  } else {
    const liveRate = await getLiveRateForCurrency(projectCurrency);
    if (liveRate) {
      currentRate = liveRate;
      rateSourceLabel = `Using live ${projectCurrency}-INR rate`;
    } else {
      const sortedByDate = [...paidInvoices]
        .filter((i) => i.paidDate && i.eurToInrRate)
        .sort((a, b) => b.paidDate!.localeCompare(a.paidDate!));
      if (sortedByDate.length > 0) {
        currentRate = sortedByDate[0].eurToInrRate!;
        rateSourceLabel = "Using latest paid invoice FX rate";
      } else {
        currentRate = 90;
        rateSourceLabel = "Using fallback EUR-INR rate";
      }
    }
  }

  // Compute average deduction % from paid invoices. Sanity-cap at 10% so a
  // single bad data point can't distort projections. This pct is applied ONLY
  // to sent/draft invoices that don't yet have actual payment details — paid
  // invoices use their stored netInrAmount directly.
  const totalEur = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const avgRate = totalEur > 0
    ? paidInvoices.reduce((s, i) => s + (i.eurToInrRate ?? 0) * (i.total ?? 0), 0) / totalEur
    : currentRate;
  const totalGrossInr = totalEur * avgRate;
  const totalDeductions = paidInvoices.reduce((s, i) => s + (i.platformCharges ?? 0) + (i.bankCharges ?? 0), 0);
  const rawDeductionPct = totalGrossInr > 0 ? totalDeductions / totalGrossInr : 0;
  const deductionPct = Math.min(Math.max(0, rawDeductionPct), 0.10);

  // Bucket every invoice (paid/sent/draft) by the month it was *issued*, using
  // issueDate. This is tax-page-specific: April income = invoices generated in April,
  // not money received in April or days worked in April. Paid invoices contribute
  // their actual netInrAmount; open invoices contribute an estimate of net INR from
  // their EUR total. Both modes consult invoices first — only the fallback differs.
  const fyInvoicesRaw = db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      netInrAmount: invoices.netInrAmount,
      total: invoices.total,
      issueDate: invoices.issueDate,
      status: invoices.status,
      eurToInrRate: invoices.eurToInrRate,
    })
    .from(invoices)
    .where(
      and(
        sql`${invoices.status} IN ('paid', 'sent', 'draft')`,
        sql`${invoices.issueDate} >= ${fyStart}`,
        sql`${invoices.issueDate} <= ${fyEnd}`,
      )
    )
    .all();

  // March invoices for the FY (last month — March of startYear+1). The user can
  // simulate "what if I defer March income to next FY" without mutating data.
  const fyEndMonthKey = `${startYear + 1}-03`;
  const marchInvoices = fyInvoicesRaw
    .filter((inv) => inv.issueDate && inv.issueDate.startsWith(fyEndMonthKey))
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      netInrAmount: inv.netInrAmount,
      total: inv.total,
      status: inv.status,
    }));

  const fyInvoices = deferMarch
    ? fyInvoicesRaw.filter((inv) => !inv.issueDate?.startsWith(fyEndMonthKey))
    : fyInvoicesRaw;

  const invoiceByMonth: number[] = Array(12).fill(0);
  const hasInvoiceForMonth: boolean[] = Array(12).fill(false);
  // Per-month weighted average of the actual FX rate from paid invoices in that month.
  const paidRateNumByMonth: number[] = Array(12).fill(0);
  const paidEurByMonth: number[] = Array(12).fill(0);
  for (const inv of fyInvoices) {
    if (!inv.issueDate) continue;
    const [y, m] = inv.issueDate.split("-").map(Number);
    const idx = y === startYear ? m - 4 : m + 8;
    if (idx < 0 || idx >= 12) continue;
    const amount = inv.status === "paid"
      ? (inv.netInrAmount ?? 0)
      : Math.round((inv.total ?? 0) * currentRate * (1 - deductionPct));
    invoiceByMonth[idx] += amount;
    hasInvoiceForMonth[idx] = true;
    if (inv.status === "paid" && inv.eurToInrRate && inv.total) {
      paidRateNumByMonth[idx] += inv.eurToInrRate * inv.total;
      paidEurByMonth[idx] += inv.total;
    }
  }

  // Per-month FX rate: weighted avg of paid invoices that month, else live rate.
  const rateByMonth: number[] = Array.from({ length: 12 }, (_, i) =>
    paidEurByMonth[i] > 0 ? paidRateNumByMonth[i] / paidEurByMonth[i] : currentRate
  );

  // Months before the user started working get zeroed out — no calendar fallback.
  // We infer the work-start month from the earliest invoice ever issued.
  const earliestInvoice = db
    .select({ issueDate: sql<string>`MIN(${invoices.issueDate})` })
    .from(invoices)
    .get();
  const workStartDate = earliestInvoice?.issueDate ?? null;

  // For each month: use the invoiced amount when available, otherwise fall back to that
  // month's own calendar working-days estimate (no M-1 lag).
  const projectedMonthly: number[] = Array(12).fill(0);
  const projectedWorkingDays: (number | undefined)[] = Array(12).fill(undefined);
  const projectedLeaves: (number | undefined)[] = Array(12).fill(undefined);
  const projectedCalendarBreakdown: (ProjectionCalendarBreakdown | undefined)[] = Array(12).fill(undefined);

  for (let i = 0; i < 12; i++) {
    const calYear = i < 9 ? startYear : startYear + 1;
    const calMonth = i < 9 ? i + 4 : i - 8;
    const monthKey = `${calYear}-${String(calMonth).padStart(2, "0")}`;
    const beforeWorkStart =
      workStartDate !== null && monthKey < workStartDate.slice(0, 7);

    // Defer-March: skip the FY's last month entirely (no invoice contribution,
    // no calendar fallback). i === 11 is March in the Apr–Mar ordering.
    if (deferMarch && i === 11) continue;

    if (hasInvoiceForMonth[i]) {
      projectedMonthly[i] = invoiceByMonth[i];
      // In calendar mode, also surface the working-days context for invoice-backed
      // months so the user can see "X days / ₹<rate>" alongside the invoiced amount.
      if (mode === "calendar" && !beforeWorkStart) {
        const entries = await getDayEntriesForMonth(calYear, calMonth);
        const holidays = getFrenchHolidays(calYear);
        const augmented = withImplicitWorkingDays(entries as DayEntry[], calYear, calMonth, holidays);
        const summary = calculateMonthSummary(augmented);
        projectedWorkingDays[i] = summary.effectiveWorkingDays;
        projectedLeaves[i] = summary.leaves + summary.halfDays * 0.5;
        projectedCalendarBreakdown[i] = calculateProjectionCalendarBreakdown(augmented, holidays);
      }
      continue;
    }

    // Invoice mode: only fall back to calendar working-days for future months.
    // Past months with no invoice get zero — otherwise we'd double-count when a
    // multi-month invoice eventually lands in its issue month.
    // Calendar mode: always fall back to calendar working-days for any month
    // without an invoice, past or future.
    if (mode === "invoice" && i < monthsElapsed) continue;

    // Skip months that fall before the user began working.
    if (beforeWorkStart) continue;

    const entries = await getDayEntriesForMonth(calYear, calMonth);
    const holidays = getFrenchHolidays(calYear);
    const augmented = withImplicitWorkingDays(entries as DayEntry[], calYear, calMonth, holidays);
    const summary = calculateMonthSummary(augmented);
    const calendarBreakdown = calculateProjectionCalendarBreakdown(augmented, holidays);

    const dailyRate = defaultProjectId ? dailyRateForMonth(monthKey) : 0;

    const baseAmount = summary.effectiveWorkingDays * dailyRate;
    const grossInr = projectCurrency === "INR" ? baseAmount : baseAmount * currentRate;
    const netInr = grossInr * (1 - deductionPct);

    projectedMonthly[i] = Math.round(netInr);
    projectedWorkingDays[i] = summary.effectiveWorkingDays;
    projectedLeaves[i] = summary.leaves + summary.halfDays * 0.5;
    projectedCalendarBreakdown[i] = calendarBreakdown;
  }

  // Build monthly breakdown — invoice-backed months are actual, calendar-backed
  // months are projections.
  const monthlyBreakdown = MONTH_LABELS.map((label, i) => ({
    month: label,
    actual: projectedMonthly[i],
    projected: !hasInvoiceForMonth[i],
    workingDays: projectedWorkingDays[i],
    leaves: projectedLeaves[i],
    invoiceBased: hasInvoiceForMonth[i],
    rate: Math.round(rateByMonth[i] * 100) / 100,
    calendarBreakdown: projectedCalendarBreakdown[i],
  }));

  // Compute how much March income would have contributed if not deferred — shown
  // in the UI so the user sees the impact of the toggle.
  let marchDeferralAmount = 0;
  if (marchInvoices.length > 0) {
    for (const inv of marchInvoices) {
      marchDeferralAmount += inv.status === "paid"
        ? (inv.netInrAmount ?? 0)
        : Math.round((inv.total ?? 0) * currentRate * (1 - deductionPct));
    }
  } else {
    // No invoices issued in March — estimate calendar-based contribution
    const marchYear = startYear + 1;
    const marchKey = `${marchYear}-03`;
    const beforeStart =
      workStartDate !== null && marchKey < workStartDate.slice(0, 7);
    if (!beforeStart) {
      const entries = await getDayEntriesForMonth(marchYear, 3);
      const holidays = getFrenchHolidays(marchYear);
      const augmented = withImplicitWorkingDays(entries as DayEntry[], marchYear, 3, holidays);
      const summary = calculateMonthSummary(augmented);
      const dailyRate = defaultProjectId ? dailyRateForMonth(marchKey) : 0;
      const baseAmount = summary.effectiveWorkingDays * dailyRate;
      const grossInr = projectCurrency === "INR" ? baseAmount : baseAmount * currentRate;
      marchDeferralAmount = Math.round(grossInr * (1 - deductionPct));
    }
  }

  // FY-wide day-type totals from day_entries (with implicit weekday working days
  // filled in for unmarked dates). Skip months before the user's work-start month.
  const yearlyDayTotals = {
    workingDays: 0,
    extraWorkingDays: 0,
    halfDays: 0,
    leaves: 0,
    holidays: 0,
    effectiveWorkingDays: 0,
  };
  // Companion FY-wide calendar-position breakdown (weekday/holiday/weekend) so
  // both summary rows are computed from the same set of months and always agree.
  const yearlyCalendarBreakdown: ProjectionCalendarBreakdown = {
    weekdayWorkingDays: 0,
    publicHolidayWorkingDays: 0,
    weekendWorkingDays: 0,
  };
  for (let i = 0; i < 12; i++) {
    const calYear = i < 9 ? startYear : startYear + 1;
    const calMonth = i < 9 ? i + 4 : i - 8;
    const monthKey = `${calYear}-${String(calMonth).padStart(2, "0")}`;
    if (workStartDate && monthKey < workStartDate.slice(0, 7)) continue;
    // Exclude March from FY day totals when the user is deferring March income.
    if (deferMarch && i === 11) continue;

    const entries = await getDayEntriesForMonth(calYear, calMonth);
    const holidays = getFrenchHolidays(calYear);
    const augmented = withImplicitWorkingDays(entries as DayEntry[], calYear, calMonth, holidays);
    const summary = calculateMonthSummary(augmented);
    yearlyDayTotals.workingDays += summary.workingDays;
    yearlyDayTotals.extraWorkingDays += summary.extraWorkingDays;
    yearlyDayTotals.halfDays += summary.halfDays;
    yearlyDayTotals.leaves += summary.leaves;
    yearlyDayTotals.effectiveWorkingDays += summary.effectiveWorkingDays;

    const monthCalBreakdown = calculateProjectionCalendarBreakdown(augmented, holidays);
    yearlyCalendarBreakdown.weekdayWorkingDays += monthCalBreakdown.weekdayWorkingDays;
    yearlyCalendarBreakdown.publicHolidayWorkingDays += monthCalBreakdown.publicHolidayWorkingDays;
    yearlyCalendarBreakdown.weekendWorkingDays += monthCalBreakdown.weekendWorkingDays;

    // Count public holidays directly from the calendar (the holidays map for the
    // year), filtered to this month, since users rarely create explicit
    // dayType: "holiday" entries — the days are simply skipped from working.
    // Exclude holidays the user explicitly worked on (extra_working).
    const explicitDates = new Map(entries.map((e) => [e.date, e.dayType]));
    for (const date of holidays.keys()) {
      if (!date.startsWith(monthKey)) continue;
      const explicit = explicitDates.get(date);
      if (explicit === "extra_working" || explicit === "working" || explicit === "half_day") continue;
      yearlyDayTotals.holidays += 1;
    }
  }

  const projectedGrossReceipts = projectedMonthly.reduce((a, b) => a + b, 0);
  // 44ADA presumptive (50%) only applies up to ₹75L. Above that, tax is computed
  // on full gross receipts.
  const projectedPresumptiveIncome = projectedGrossReceipts * 0.5;
  const projectedTaxableIncome = Math.max(
    0,
    is44AdaEligible(projectedGrossReceipts) ? projectedPresumptiveIncome : projectedGrossReceipts,
  );

  const { slabBreakdown, totalTax } = calculateIncomeTax(projectedTaxableIncome);

  const projectedRebate87A = projectedTaxableIncome <= 1200000 ? Math.min(totalTax, 60000) : 0;
  const taxAfterRebate = totalTax - projectedRebate87A;
  const projectedCess = taxAfterRebate * 0.04;
  const projectedTotalTax = taxAfterRebate + projectedCess;

  // Compute the tax delta from deferring (or having deferred) March, so the UI
  // can show "save ₹X by deferring" or "saved ₹X by deferring". Honours the
  // 44ADA threshold: above ₹75L, presumptive does not apply.
  function totalTaxForGross(gross: number): number {
    const taxable = is44AdaEligible(gross) ? Math.max(0, gross * 0.5) : Math.max(0, gross);
    const { totalTax: slabTax } = calculateIncomeTax(taxable);
    const rebate = taxable <= 1200000 ? Math.min(slabTax, 60000) : 0;
    const afterRebate = slabTax - rebate;
    const cess = afterRebate * 0.04;
    return afterRebate + cess;
  }
  const grossWithMarch = deferMarch ? projectedGrossReceipts + marchDeferralAmount : projectedGrossReceipts;
  const grossWithoutMarch = deferMarch ? projectedGrossReceipts : Math.max(0, projectedGrossReceipts - marchDeferralAmount);
  const marchDeferralTaxSavings = Math.max(0, totalTaxForGross(grossWithMarch) - totalTaxForGross(grossWithoutMarch));

  const taxSummary = await getTaxSummaryForFY(financialYear);
  const totalPaid = taxSummary.total;
  const projectedBalance = projectedTotalTax - totalPaid;

  // Advance tax schedule basis: for the CURRENT FY (still in progress), assume
  // gross receipts of ₹74.5L (just under the 44ADA limit) so the schedule is
  // stable across the year and doesn't drift with the live projection. For
  // past/future FYs, fall back to the live projection.
  const ASSUMED_GROSS_RECEIPTS = PRESUMPTIVE_LIMIT_44ADA - 50000; // ₹74.5L
  const isAssumed = financialYear === getCurrentFinancialYear();
  const advanceGross = isAssumed ? ASSUMED_GROSS_RECEIPTS : projectedGrossReceipts;
  const advanceTaxable = is44AdaEligible(advanceGross)
    ? Math.max(0, advanceGross * 0.5)
    : Math.max(0, advanceGross);
  const { totalTax: advanceIncomeTax } = calculateIncomeTax(advanceTaxable);
  const advanceRebate = advanceTaxable <= 1200000 ? Math.min(advanceIncomeTax, 60000) : 0;
  const advanceAfterRebate = advanceIncomeTax - advanceRebate;
  const advanceCess = advanceAfterRebate * 0.04;
  const advanceTotalTax = advanceAfterRebate + advanceCess;

  const todayIso = new Date().toISOString().slice(0, 10);
  const dueDateForQuarter: Record<TaxQuarter, string> = {
    Q1: `${startYear}-06-15`,
    Q2: `${startYear}-09-15`,
    Q3: `${startYear}-12-15`,
    Q4: `${startYear + 1}-03-15`,
  };
  const quarterOrder: TaxQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
  let cumulativePaid = 0;
  let prevCumulativeDue = 0;
  const advanceTaxSchedule = quarterOrder.map((q) => {
    const config = TAX_QUARTERS[q];
    cumulativePaid += taxSummary.byQuarter[q];
    const cumulativeDue = Math.round((advanceTotalTax * config.cumPercent) / 100);
    const installment = cumulativeDue - prevCumulativeDue;
    prevCumulativeDue = cumulativeDue;
    const balance = Math.max(0, cumulativeDue - cumulativePaid);
    const dueDate = dueDateForQuarter[q];
    let status: "paid" | "upcoming" | "overdue";
    if (cumulativePaid >= cumulativeDue) status = "paid";
    else if (todayIso > dueDate) status = "overdue";
    else status = "upcoming";
    return {
      quarter: q,
      label: config.label,
      dueDate,
      cumulativePct: config.cumPercent,
      cumulativeDue,
      installment,
      cumulativePaid,
      balance,
      status,
    };
  });

  return {
    monthlyBreakdown,
    monthsElapsed,
    monthsRemaining,
    avgRate: Math.round(currentRate * 100) / 100,
    mode,
    modeSummary: getProjectionModeSummary(mode),
    rateSourceLabel,
    projectedGrossReceipts: Math.round(projectedGrossReceipts),
    projectedPresumptiveIncome: Math.round(projectedPresumptiveIncome),
    projectedTaxableIncome: Math.round(projectedTaxableIncome),
    slabBreakdown,
    projectedIncomeTax: totalTax,
    projectedRebate87A,
    projectedCess,
    projectedTotalTax,
    totalPaid,
    projectedBalance,
    advanceTaxBasis: {
      grossReceipts: Math.round(advanceGross),
      totalTax: Math.round(advanceTotalTax),
      isAssumed,
    },
    advanceTaxSchedule,
    yearlyDayTotals,
    yearlyCalendarBreakdown,
    marchInvoices,
    marchDeferralAmount,
    marchDeferralTaxSavings: Math.round(marchDeferralTaxSavings),
    deferMarch,
  };
}

function calculateProjectionCalendarBreakdown(
  entries: DayEntry[],
  holidays: Map<string, string>,
): ProjectionCalendarBreakdown {
  const breakdown: ProjectionCalendarBreakdown = {
    weekdayWorkingDays: 0,
    publicHolidayWorkingDays: 0,
    weekendWorkingDays: 0,
  };

  for (const entry of entries) {
    let weight = 0;
    if (entry.dayType === "working" || entry.dayType === "extra_working") {
      weight = 1;
    } else if (entry.dayType === "half_day") {
      weight = 0.5;
    }

    if (weight === 0) continue;

    if (holidays.has(entry.date)) {
      breakdown.publicHolidayWorkingDays += weight;
      continue;
    }

    const dayOfWeek = new Date(`${entry.date}T00:00:00`).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      breakdown.weekendWorkingDays += weight;
    } else {
      breakdown.weekdayWorkingDays += weight;
    }
  }

  return breakdown;
}

function getProjectionModeSummary(mode: TaxProjectionMode): string {
  switch (mode) {
    case "calendar":
      return "Use invoices when issued; otherwise estimate income from calendar working days, including past months.";
    case "invoice":
    default:
      return "Use invoices when issued; only project future months from calendar working days. Past months without an invoice show no income.";
  }
}

async function getLiveRateForCurrency(currency: string): Promise<number | null> {
  const { getLiveRateToInr } = await import("@/lib/exchange-rates");
  return getLiveRateToInr(currency);
}

export async function getTaxSummaryForFY(financialYear: string): Promise<{
  byQuarter: Record<TaxQuarter, number>;
  total: number;
}> {
  await assertAdminAccess();
  const payments = await getTaxPayments(financialYear);
  const byQuarter: Record<TaxQuarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  let total = 0;
  for (const p of payments) {
    byQuarter[p.quarter] += p.amount;
    total += p.amount;
  }
  return { byQuarter, total };
}

// --- Tax Payment Attachments ---

export async function getTaxPaymentAttachments(taxPaymentId: number): Promise<TaxPaymentAttachment[]> {
  await assertAuthenticatedAccess();
  return db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.taxPaymentId, taxPaymentId))
    .orderBy(desc(taxPaymentAttachments.createdAt))
    .all() as TaxPaymentAttachment[];
}

export async function addTaxPaymentAttachment(data: {
  taxPaymentId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  label?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(taxPaymentAttachments)
    .values({
      taxPaymentId: data.taxPaymentId,
      fileName: data.fileName,
      originalName: data.originalName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      label: data.label || null,
    })
    .run();
  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function deleteTaxPaymentAttachment(id: number): Promise<{ success: boolean; fileName?: string }> {
  await assertAdminAccess();
  const attachment = db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.id, id))
    .get() as TaxPaymentAttachment | undefined;

  if (!attachment) return { success: false };

  db.delete(taxPaymentAttachments).where(eq(taxPaymentAttachments.id, id)).run();
  return { success: true, fileName: attachment.fileName };
}
