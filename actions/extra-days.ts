"use server";

import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { dayEntries, extraDayAllocations, extraDayBuckets, extraDayTargets } from "@/db/schema";
import { assertAdminAccess } from "@/lib/auth";
import type {
  ExtraDayAllocation,
  ExtraDayAllocationDetail,
  ExtraDayBucket,
  ExtraDayBucketSummary,
  ExtraDaysPlannerData,
  ExtraDayTarget,
  ExtraDayTargetSummary,
} from "@/lib/types";
import { extraDayAllocationSchema, extraDayBucketSchema, extraDayTargetSchema } from "@/lib/validators";
import { getFYDateRange, getFrenchHolidays } from "@/lib/constants";
import { getLeavePolicy } from "./settings";

const STARTER_BUCKETS = [
  "Car / Camping Gear",
  "Emergency Fund",
  "Pure Cash",
  "Travel",
] as const;

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getReadinessLabel(target: ExtraDayTarget, fundedDays: number, fundedAmountInr: number): {
  label: string;
  isReady: boolean;
} {
  if (target.status === "archived") {
    return { label: "Archived", isReady: false };
  }
  if (target.status === "completed") {
    return { label: target.targetType === "money" ? "Purchased" : "Completed", isReady: false };
  }

  if (target.targetType === "day" && target.goalDays && fundedDays >= target.goalDays) {
    return { label: "Ready", isReady: true };
  }
  if (target.targetType === "money" && target.goalAmountInr && fundedAmountInr >= target.goalAmountInr) {
    return { label: "Ready to Buy", isReady: true };
  }
  return { label: "Active", isReady: false };
}

async function getCurrentAllocatableDays(financialYear: string): Promise<number> {
  const balanceData = await getPlannerSourceBalance(financialYear);
  return Math.max(balanceData.leaveBalance + balanceData.totalExtraWorking, 0);
}

function getExistingAllocationDays(financialYear: string, excludeId?: number): number {
  const conditions = [eq(extraDayAllocations.financialYear, financialYear)];
  if (excludeId !== undefined) {
    conditions.push(ne(extraDayAllocations.id, excludeId));
  }

  const row = db
    .select({ total: sql<number>`coalesce(sum(${extraDayAllocations.days}), 0)` })
    .from(extraDayAllocations)
    .where(and(...conditions))
    .get();

  return Number(row?.total ?? 0);
}

function getCurrentAllocationDays(financialYear: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${extraDayAllocations.days}), 0)` })
    .from(extraDayAllocations)
    .where(eq(extraDayAllocations.financialYear, financialYear))
    .get();

  return Number(row?.total ?? 0);
}

async function validateAllocationCapacity(financialYear: string, days: number, allocationId?: number): Promise<void> {
  const allocatableDays = await getCurrentAllocatableDays(financialYear);
  const currentTotal = getCurrentAllocationDays(financialYear);
  const proposedTotal = getExistingAllocationDays(financialYear, allocationId) + days;

  if (proposedTotal <= allocatableDays) {
    return;
  }

  // If the planner is already over-allocated because the calendar changed,
  // allow updates that do not make the over-allocation worse.
  if (allocationId !== undefined && currentTotal > allocatableDays && proposedTotal <= currentTotal) {
    return;
  }

  throw new Error("This allocation exceeds the planner's available extra days for the selected FY.");
}

function assertBucketAvailable(bucket: ExtraDayBucket | undefined): asserts bucket is ExtraDayBucket {
  if (!bucket) {
    throw new Error("Bucket not found.");
  }
  if (!bucket.isActive) {
    throw new Error("Archived buckets cannot receive new allocations or targets.");
  }
}

function assertTargetAvailable(target: ExtraDayTarget | undefined): asserts target is ExtraDayTarget {
  if (!target) {
    throw new Error("Target not found.");
  }
  if (target.status !== "active") {
    throw new Error("Only active targets can receive new allocations.");
  }
}

function getNextBucketSortOrder(): number {
  const row = db
    .select({ sortOrder: extraDayBuckets.sortOrder })
    .from(extraDayBuckets)
    .orderBy(desc(extraDayBuckets.sortOrder))
    .limit(1)
    .get();
  return (row?.sortOrder ?? -1) + 1;
}

function getNextTargetSortOrder(bucketId: number): number {
  const row = db
    .select({ sortOrder: extraDayTargets.sortOrder })
    .from(extraDayTargets)
    .where(eq(extraDayTargets.bucketId, bucketId))
    .orderBy(desc(extraDayTargets.sortOrder))
    .limit(1)
    .get();
  return (row?.sortOrder ?? -1) + 1;
}

export async function seedDefaultExtraDayBuckets(): Promise<{ success: boolean }> {
  await assertAdminAccess();

  const existing = db.select({ id: extraDayBuckets.id }).from(extraDayBuckets).limit(1).all();
  if (existing.length > 0) {
    return { success: true };
  }

  db.transaction((tx) => {
    STARTER_BUCKETS.forEach((name, index) => {
      tx.insert(extraDayBuckets).values({
        name,
        sortOrder: index,
        isActive: true,
      }).run();
    });
  });

  return { success: true };
}

export async function getExtraDaysPlannerData(financialYear: string): Promise<ExtraDaysPlannerData> {
  await assertAdminAccess();

  const source = await getPlannerSourceBalance(financialYear);
  const rawExtraBalance = source.leaveBalance + source.totalExtraWorking;
  const allocatableDays = Math.max(rawExtraBalance, 0);

  const buckets = db
    .select()
    .from(extraDayBuckets)
    .orderBy(asc(extraDayBuckets.sortOrder), asc(extraDayBuckets.name))
    .all() as ExtraDayBucket[];

  const targets = db
    .select()
    .from(extraDayTargets)
    .orderBy(asc(extraDayTargets.sortOrder), asc(extraDayTargets.name))
    .all() as ExtraDayTarget[];

  const allocations = db
    .select({
      id: extraDayAllocations.id,
      bucketId: extraDayAllocations.bucketId,
      targetId: extraDayAllocations.targetId,
      financialYear: extraDayAllocations.financialYear,
      kind: extraDayAllocations.kind,
      confirmedDate: extraDayAllocations.confirmedDate,
      days: extraDayAllocations.days,
      dailyRate: extraDayAllocations.dailyRate,
      amountInr: extraDayAllocations.amountInr,
      notes: extraDayAllocations.notes,
      createdAt: extraDayAllocations.createdAt,
      bucketName: extraDayBuckets.name,
      targetName: extraDayTargets.name,
    })
    .from(extraDayAllocations)
    .innerJoin(extraDayBuckets, eq(extraDayAllocations.bucketId, extraDayBuckets.id))
    .leftJoin(extraDayTargets, eq(extraDayAllocations.targetId, extraDayTargets.id))
    .where(eq(extraDayAllocations.financialYear, financialYear))
    .orderBy(desc(extraDayAllocations.confirmedDate), desc(extraDayAllocations.createdAt))
    .all() as ExtraDayAllocationDetail[];

  const targetAllocations = new Map<number, ExtraDayAllocationDetail[]>();
  const bucketAllocations = new Map<number, ExtraDayAllocationDetail[]>();

  for (const allocation of allocations) {
    const byBucket = bucketAllocations.get(allocation.bucketId) ?? [];
    byBucket.push(allocation);
    bucketAllocations.set(allocation.bucketId, byBucket);

    if (allocation.targetId != null) {
      const byTarget = targetAllocations.get(allocation.targetId) ?? [];
      byTarget.push(allocation);
      targetAllocations.set(allocation.targetId, byTarget);
    }
  }

  const targetsByBucket = new Map<number, ExtraDayTarget[]>();
  for (const target of targets) {
    const list = targetsByBucket.get(target.bucketId) ?? [];
    list.push(target);
    targetsByBucket.set(target.bucketId, list);
  }

  const bucketSummaries: ExtraDayBucketSummary[] = buckets.map((bucket) => {
    const bucketRows = bucketAllocations.get(bucket.id) ?? [];
    const bucketTargets = targetsByBucket.get(bucket.id) ?? [];

    const targetSummaries: ExtraDayTargetSummary[] = bucketTargets.map((target) => {
      const rows = targetAllocations.get(target.id) ?? [];
      const fundedDays = rows.reduce((sum, row) => sum + row.days, 0);
      const fundedAmountInr = rows.reduce((sum, row) => sum + (row.amountInr ?? 0), 0);
      const remainingDays = target.targetType === "day"
        ? Math.max((target.goalDays ?? 0) - fundedDays, 0)
        : 0;
      const remainingAmountInr = target.targetType === "money"
        ? Math.max((target.goalAmountInr ?? 0) - fundedAmountInr, 0)
        : 0;
      const fundedPct = target.targetType === "day"
        ? (target.goalDays ? Math.min(fundedDays / target.goalDays, 1) : 0)
        : (target.goalAmountInr ? Math.min(fundedAmountInr / target.goalAmountInr, 1) : 0);
      const readiness = getReadinessLabel(target, fundedDays, fundedAmountInr);

      return {
        target,
        fundedDays,
        fundedAmountInr,
        remainingDays,
        remainingAmountInr,
        fundedPct,
        readinessLabel: readiness.label,
        isReady: readiness.isReady,
      };
    });

    return {
      bucket,
      targets: targetSummaries,
      totalDays: bucketRows.reduce((sum, row) => sum + row.days, 0),
      totalAmountInr: bucketRows.reduce((sum, row) => sum + (row.amountInr ?? 0), 0),
      reserveDayDays: bucketRows
        .filter((row) => row.targetId == null && row.kind === "day")
        .reduce((sum, row) => sum + row.days, 0),
      reserveMoneyDays: bucketRows
        .filter((row) => row.targetId == null && row.kind === "money")
        .reduce((sum, row) => sum + row.days, 0),
      reserveMoneyAmountInr: bucketRows
        .filter((row) => row.targetId == null && row.kind === "money")
        .reduce((sum, row) => sum + (row.amountInr ?? 0), 0),
    };
  });

  const allocatedDays = allocations.reduce((sum, row) => sum + row.days, 0);
  const totalAllocatedAmountInr = allocations.reduce((sum, row) => sum + (row.amountInr ?? 0), 0);
  const overAllocatedDays = Math.max(allocatedDays - allocatableDays, 0);
  const remainingPlannerDays = Math.max(allocatableDays - allocatedDays, 0);

  return {
    financialYear,
    balanceData: {
      leaveBalance: source.leaveBalance,
      totalExtraWorking: source.totalExtraWorking,
      leavesAllowed: source.leavesAllowed,
      leavesTaken: source.leavesTaken,
      totalWeekdays: source.totalWeekdays,
      publicHolidayWeekdays: source.publicHolidayWeekdays,
      totalPossibleWorkDays: source.totalPossibleWorkDays,
      totalDaysWorked: source.totalDaysWorked,
      extraWorkingPublicHolidays: source.extraWorkingPublicHolidays,
      extraWorkingWeekends: source.extraWorkingWeekends,
    },
    rawExtraBalance,
    allocatableDays,
    allocatedDays,
    remainingPlannerDays,
    overAllocatedDays,
    totalAllocatedAmountInr,
    buckets: bucketSummaries,
    allocations,
  };
}

export async function createExtraDayBucket(data: { name: string }): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const parsed = extraDayBucketSchema.parse(data);
    db.insert(extraDayBuckets).values({
      name: parsed.name,
      sortOrder: getNextBucketSortOrder(),
      isActive: true,
    }).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create bucket." };
  }
}

export async function updateExtraDayBucket(id: number, data: { name: string }): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const parsed = extraDayBucketSchema.parse(data);
    db.update(extraDayBuckets).set({ name: parsed.name }).where(eq(extraDayBuckets.id, id)).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update bucket." };
  }
}

export async function archiveExtraDayBucket(id: number): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    db.update(extraDayBuckets).set({ isActive: false }).where(eq(extraDayBuckets.id, id)).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to archive bucket." };
  }
}

export async function createExtraDayTarget(
  data: {
    bucketId: number;
    name: string;
    targetType: "day" | "money";
    goalDays?: number | null;
    goalAmountInr?: number | null;
    notes?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const parsed = extraDayTargetSchema.parse({
      ...data,
      goalDays: data.targetType === "day" ? data.goalDays : null,
      goalAmountInr: data.targetType === "money" ? data.goalAmountInr : null,
    });
    const bucket = db.select().from(extraDayBuckets).where(eq(extraDayBuckets.id, parsed.bucketId)).get() as ExtraDayBucket | undefined;
    assertBucketAvailable(bucket);

    db.insert(extraDayTargets).values({
      bucketId: parsed.bucketId,
      name: parsed.name,
      targetType: parsed.targetType,
      goalDays: parsed.targetType === "day" ? parsed.goalDays : null,
      goalAmountInr: parsed.targetType === "money" ? parsed.goalAmountInr : null,
      status: "active",
      sortOrder: getNextTargetSortOrder(parsed.bucketId),
      notes: cleanText(parsed.notes),
    }).run();

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create target." };
  }
}

export async function updateExtraDayTarget(
  id: number,
  data: {
    bucketId: number;
    name: string;
    targetType: "day" | "money";
    goalDays?: number | null;
    goalAmountInr?: number | null;
    notes?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const parsed = extraDayTargetSchema.parse({
      ...data,
      goalDays: data.targetType === "day" ? data.goalDays : null,
      goalAmountInr: data.targetType === "money" ? data.goalAmountInr : null,
    });
    const bucket = db.select().from(extraDayBuckets).where(eq(extraDayBuckets.id, parsed.bucketId)).get() as ExtraDayBucket | undefined;
    assertBucketAvailable(bucket);

    db.update(extraDayTargets).set({
      bucketId: parsed.bucketId,
      name: parsed.name,
      targetType: parsed.targetType,
      goalDays: parsed.targetType === "day" ? parsed.goalDays : null,
      goalAmountInr: parsed.targetType === "money" ? parsed.goalAmountInr : null,
      notes: cleanText(parsed.notes),
    }).where(eq(extraDayTargets.id, id)).run();

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update target." };
  }
}

export async function archiveExtraDayTarget(id: number): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    db.update(extraDayTargets).set({ status: "archived" }).where(eq(extraDayTargets.id, id)).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to archive target." };
  }
}

export async function markExtraDayTargetCompleted(id: number): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    db.update(extraDayTargets).set({ status: "completed" }).where(eq(extraDayTargets.id, id)).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update target." };
  }
}

export async function createExtraDayAllocation(
  data: {
    bucketId: number;
    targetId?: number | null;
    financialYear: string;
    kind: "day" | "money";
    confirmedDate: string;
    days: number;
    dailyRate?: number | null;
    notes?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const amountInr = data.kind === "money" ? data.days * (data.dailyRate ?? 0) : null;
    const parsed = extraDayAllocationSchema.parse({
      ...data,
      targetId: data.targetId ?? null,
      dailyRate: data.kind === "money" ? data.dailyRate : null,
      amountInr,
    });

    const bucket = db.select().from(extraDayBuckets).where(eq(extraDayBuckets.id, parsed.bucketId)).get() as ExtraDayBucket | undefined;
    assertBucketAvailable(bucket);

    if (parsed.targetId != null) {
      const target = db.select().from(extraDayTargets).where(eq(extraDayTargets.id, parsed.targetId)).get() as ExtraDayTarget | undefined;
      assertTargetAvailable(target);
      if (target.bucketId !== parsed.bucketId) {
        throw new Error("Target does not belong to the selected bucket.");
      }
      if (target.targetType !== parsed.kind) {
        throw new Error("Allocation type must match the selected target.");
      }
    }

    await validateAllocationCapacity(parsed.financialYear, parsed.days);

    db.insert(extraDayAllocations).values({
      bucketId: parsed.bucketId,
      targetId: parsed.targetId ?? null,
      financialYear: parsed.financialYear,
      kind: parsed.kind,
      confirmedDate: parsed.confirmedDate,
      days: parsed.days,
      dailyRate: parsed.kind === "money" ? parsed.dailyRate : null,
      amountInr: parsed.kind === "money" ? parsed.days * parsed.dailyRate : null,
      notes: cleanText(parsed.notes),
    }).run();

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create allocation." };
  }
}

export async function updateExtraDayAllocation(
  id: number,
  data: {
    bucketId: number;
    targetId?: number | null;
    financialYear: string;
    kind: "day" | "money";
    confirmedDate: string;
    days: number;
    dailyRate?: number | null;
    notes?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    const amountInr = data.kind === "money" ? data.days * (data.dailyRate ?? 0) : null;
    const parsed = extraDayAllocationSchema.parse({
      ...data,
      targetId: data.targetId ?? null,
      dailyRate: data.kind === "money" ? data.dailyRate : null,
      amountInr,
    });

    const existing = db.select().from(extraDayAllocations).where(eq(extraDayAllocations.id, id)).get() as ExtraDayAllocation | undefined;
    if (!existing) {
      throw new Error("Allocation not found.");
    }

    const bucket = db.select().from(extraDayBuckets).where(eq(extraDayBuckets.id, parsed.bucketId)).get() as ExtraDayBucket | undefined;
    assertBucketAvailable(bucket);

    if (parsed.targetId != null) {
      const target = db.select().from(extraDayTargets).where(eq(extraDayTargets.id, parsed.targetId)).get() as ExtraDayTarget | undefined;
      assertTargetAvailable(target);
      if (target.bucketId !== parsed.bucketId) {
        throw new Error("Target does not belong to the selected bucket.");
      }
      if (target.targetType !== parsed.kind) {
        throw new Error("Allocation type must match the selected target.");
      }
    }

    await validateAllocationCapacity(parsed.financialYear, parsed.days, id);

    db.update(extraDayAllocations).set({
      bucketId: parsed.bucketId,
      targetId: parsed.targetId ?? null,
      financialYear: parsed.financialYear,
      kind: parsed.kind,
      confirmedDate: parsed.confirmedDate,
      days: parsed.days,
      dailyRate: parsed.kind === "money" ? parsed.dailyRate : null,
      amountInr: parsed.kind === "money" ? parsed.days * parsed.dailyRate : null,
      notes: cleanText(parsed.notes),
    }).where(eq(extraDayAllocations.id, id)).run();

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update allocation." };
  }
}

export async function deleteExtraDayAllocation(id: number): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  try {
    db.delete(extraDayAllocations).where(eq(extraDayAllocations.id, id)).run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete allocation." };
  }
}

async function getPlannerSourceBalance(financialYear: string): Promise<{
  leaveBalance: number;
  totalExtraWorking: number;
  leavesAllowed: number;
  leavesTaken: number;
  totalWeekdays: number;
  publicHolidayWeekdays: number;
  totalPossibleWorkDays: number;
  totalDaysWorked: number;
  extraWorkingPublicHolidays: number;
  extraWorkingWeekends: number;
}> {
  const policy = await getLeavePolicy();
  const { start: fyStart, end: fyEnd } = getFYDateRange(financialYear);
  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (todayStr < fyStart) {
    return {
      leaveBalance: 0,
      totalExtraWorking: 0,
      leavesAllowed: 0,
      leavesTaken: 0,
      totalWeekdays: 0,
      publicHolidayWeekdays: 0,
      totalPossibleWorkDays: 0,
      totalDaysWorked: 0,
      extraWorkingPublicHolidays: 0,
      extraWorkingWeekends: 0,
    };
  }

  const effectiveEnd = todayStr < fyEnd ? todayStr : fyEnd;
  const trackingStart = `${policy.trackingStartDate}-01`;
  const effectiveStart = trackingStart > fyStart ? trackingStart : fyStart;

  if (effectiveEnd < effectiveStart) {
    return {
      leaveBalance: 0,
      totalExtraWorking: 0,
      leavesAllowed: 0,
      leavesTaken: 0,
      totalWeekdays: 0,
      publicHolidayWeekdays: 0,
      totalPossibleWorkDays: 0,
      totalDaysWorked: 0,
      extraWorkingPublicHolidays: 0,
      extraWorkingWeekends: 0,
    };
  }

  const entries = db
    .select()
    .from(dayEntries)
    .where(and(sql`${dayEntries.date} >= ${effectiveStart}`, sql`${dayEntries.date} <= ${effectiveEnd}`))
    .orderBy(dayEntries.date)
    .all();

  const leavesTaken = entries.reduce((sum, entry) => {
    if (entry.dayType === "leave") return sum + 1;
    if (entry.dayType === "half_day") return sum + 0.5;
    return sum;
  }, 0);

  const holidaySet = new Set([
    ...Array.from(getFrenchHolidays(new Date(`${effectiveStart}T00:00:00`).getFullYear()).keys()),
    ...Array.from(getFrenchHolidays(new Date(`${effectiveEnd}T00:00:00`).getFullYear()).keys()),
  ]);
  const totalWeekdays = countWeekdays(effectiveStart, effectiveEnd);
  const publicHolidayWeekdays = Array.from(holidaySet).filter((dateStr) => {
    if (dateStr < effectiveStart || dateStr > effectiveEnd) return false;
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    return day !== 0 && day !== 6;
  }).length;
  const totalPossibleWorkDays = Math.max(totalWeekdays - publicHolidayWeekdays, 0);

  const extraWorkingPublicHolidays = entries.filter((entry) => {
    if (entry.dayType !== "extra_working") return false;
    const day = new Date(`${entry.date}T00:00:00`).getDay();
    return day !== 0 && day !== 6 && holidaySet.has(entry.date);
  }).length;

  const extraWorkingWeekends = entries.filter((entry) => {
    if (entry.dayType !== "extra_working") return false;
    const day = new Date(`${entry.date}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }).length;

  const totalExtraWorking = entries.filter((entry) => entry.dayType === "extra_working").length;
  const leavesAllowed = calculateAccruedLeaves(policy.leavesPerMonth, effectiveStart, effectiveEnd);
  const totalDaysWorked = Math.max(totalPossibleWorkDays - leavesTaken, 0);

  return {
    leaveBalance: leavesAllowed - leavesTaken,
    totalExtraWorking,
    leavesAllowed,
    leavesTaken,
    totalWeekdays,
    publicHolidayWeekdays,
    totalPossibleWorkDays,
    totalDaysWorked,
    extraWorkingPublicHolidays,
    extraWorkingWeekends,
  };
}

function calculateAccruedLeaves(leavesPerMonth: number, startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (end < start) return 0;

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let total = 0;

  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const activeStart = start > monthStart ? start : monthStart;
    const activeEnd = end < monthEnd ? end : monthEnd;

    if (activeEnd >= activeStart) {
      const daysInMonth = monthEnd.getDate();
      const coveredDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      total += leavesPerMonth * (coveredDays / daysInMonth);
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return Number(total.toFixed(2));
}

function countWeekdays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  let total = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      total++;
    }
  }

  return total;
}
