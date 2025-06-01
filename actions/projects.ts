"use server";

import { db } from "@/db";
import { projects, projectRates } from "@/db/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import type { Project, ProjectRate } from "@/lib/types";
import { assertAdminAccess } from "@/lib/auth";

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeRateEffectiveFrom(value: string): string {
  const trimmed = value.trim();
  if (DATE_KEY_REGEX.test(trimmed)) return trimmed;
  if (MONTH_KEY_REGEX.test(trimmed)) return `${trimmed}-01`;
  throw new Error("Effective date must be in YYYY-MM-DD format");
}

function normalizeRateLookupDate(value: string): string {
  const trimmed = value.trim();
  if (DATE_KEY_REGEX.test(trimmed)) return trimmed;
  if (MONTH_KEY_REGEX.test(trimmed)) return `${trimmed}-31`;
  throw new Error("Rate lookup date must be in YYYY-MM or YYYY-MM-DD format");
}

function getStoredRateForDate(
  projectId: number,
  lookupDate: string,
): number | null {
  const row = db
    .select({ dailyRate: projectRates.dailyRate })
    .from(projectRates)
    .where(
      and(
        eq(projectRates.projectId, projectId),
        lte(projectRates.monthKey, lookupDate),
      ),
    )
    .orderBy(desc(projectRates.monthKey))
    .limit(1)
    .get();

  return row?.dailyRate ?? null;
}

export async function getProjectsByClient(clientId: number): Promise<Project[]> {
  await assertAdminAccess();
  const today = new Date().toISOString().split("T")[0];
  const rows = db
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(projects.name)
    .all() as Project[];

  return rows.map((project) => ({
    ...project,
    currentDailyRate:
      getStoredRateForDate(project.id, today) ?? project.defaultDailyRate,
  }));
}

export async function getActiveProjects(): Promise<(Project & { clientName: string })[]> {
  await assertAdminAccess();
  // Manual join since we need client name
  const { clients } = await import("@/db/schema");
  const allProjects = db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
      defaultDailyRate: projects.defaultDailyRate,
      isActive: projects.isActive,
      createdAt: projects.createdAt,
      clientName: clients.name,
      currency: projects.currency,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.isActive, true))
    .orderBy(projects.name)
    .all();

  return allProjects as (Project & { clientName: string })[];
}

export async function getProject(id: number): Promise<Project | null> {
  await assertAdminAccess();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  return (project as Project) ?? null;
}

export async function createProject(data: {
  clientId: number;
  name: string;
  defaultDailyRate: number;
  currency?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(projects)
    .values({
      clientId: data.clientId,
      name: data.name,
      defaultDailyRate: data.defaultDailyRate,
      currency: data.currency || "EUR",
    })
    .run();

  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateProject(
  id: number,
  data: { name?: string; defaultDailyRate?: number; currency?: string },
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.update(projects).set(data).where(eq(projects.id, id)).run();
  return { success: true };
}

export async function toggleProjectActive(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return { success: false };

  db.update(projects)
    .set({ isActive: !project.isActive })
    .where(eq(projects.id, id))
    .run();

  return { success: true };
}

export async function getProjectRate(
  projectId: number,
  effectiveFrom: string,
): Promise<number | null> {
  await assertAdminAccess();
  const normalizedDate = normalizeRateEffectiveFrom(effectiveFrom);
  const rate = db
    .select()
    .from(projectRates)
    .where(
      and(
        eq(projectRates.projectId, projectId),
        eq(projectRates.monthKey, normalizedDate),
      ),
    )
    .get();

  return rate ? (rate as ProjectRate).dailyRate : null;
}

export async function setProjectRate(
  projectId: number,
  effectiveFrom: string,
  dailyRate: number,
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const normalizedDate = normalizeRateEffectiveFrom(effectiveFrom);
  const existing = db
    .select()
    .from(projectRates)
    .where(
      and(
        eq(projectRates.projectId, projectId),
        eq(projectRates.monthKey, normalizedDate),
      ),
    )
    .get();

  if (existing) {
    db.update(projectRates)
      .set({ dailyRate })
      .where(eq(projectRates.id, (existing as ProjectRate).id))
      .run();
  } else {
    db.insert(projectRates)
      .values({ projectId, monthKey: normalizedDate, dailyRate })
      .run();
  }

  return { success: true };
}

export async function updateProjectDailyRate(
  projectId: number,
  dailyRate: number,
  effectiveFrom: string,
): Promise<{ success: boolean; error?: string }> {
  await assertAdminAccess();

  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return { success: false, error: "Daily rate must be greater than 0" };
  }

  const project = await getProject(projectId);
  if (!project) {
    return { success: false, error: "Project not found" };
  }

  try {
    await setProjectRate(projectId, effectiveFrom, dailyRate);
    return { success: true };
  } catch {
    return { success: false, error: "Effective date must be in YYYY-MM-DD format" };
  }
}

export async function getProjectRates(projectId: number): Promise<ProjectRate[]> {
  await assertAdminAccess();
  return db
    .select()
    .from(projectRates)
    .where(eq(projectRates.projectId, projectId))
    .orderBy(projectRates.monthKey)
    .all() as ProjectRate[];
}

export async function getProjectRateTimeline(projectId: number): Promise<ProjectRate[]> {
  return getProjectRates(projectId);
}

export async function deleteProjectRate(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(projectRates).where(eq(projectRates.id, id)).run();
  return { success: true };
}

export async function getEffectiveRate(
  projectId: number,
  effectiveOn: string,
): Promise<number> {
  await assertAdminAccess();
  const lookupDate = normalizeRateLookupDate(effectiveOn);

  const project = await getProject(projectId);
  if (!project) return 0;

  const storedRate = getStoredRateForDate(projectId, lookupDate);
  return storedRate ?? project.defaultDailyRate;
}
