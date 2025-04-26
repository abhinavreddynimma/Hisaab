"use server";

import { db } from "@/db";
import { projects, projectRates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Project, ProjectRate } from "@/lib/types";
import { assertAdminAccess } from "@/lib/auth";

export async function getProjectsByClient(clientId: number): Promise<Project[]> {
  await assertAdminAccess();
  return db
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(projects.name)
    .all() as Project[];
}

export async function getActiveProjects(): Promise<(Project & { clientName: string })[]> {
  await assertAdminAccess();
  const rows = db.query.projects.findMany({
    where: eq(projects.isActive, true),
    with: {},
  });
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
  data: { name?: string; defaultDailyRate?: number; currency?: string }
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
  monthKey: string
): Promise<number | null> {
  await assertAdminAccess();
  const rate = db
    .select()
    .from(projectRates)
    .where(
      and(eq(projectRates.projectId, projectId), eq(projectRates.monthKey, monthKey))
    )
    .get();

  return rate ? (rate as ProjectRate).dailyRate : null;
}

export async function setProjectRate(
  projectId: number,
  monthKey: string,
  dailyRate: number
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const existing = db
    .select()
    .from(projectRates)
    .where(
      and(eq(projectRates.projectId, projectId), eq(projectRates.monthKey, monthKey))
    )
    .get();

  if (existing) {
    db.update(projectRates)
      .set({ dailyRate })
      .where(eq(projectRates.id, (existing as ProjectRate).id))
      .run();
  } else {
    db.insert(projectRates).values({ projectId, monthKey, dailyRate }).run();
  }

  return { success: true };
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

export async function deleteProjectRate(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.delete(projectRates).where(eq(projectRates.id, id)).run();
  return { success: true };
}

export async function getEffectiveRate(
  projectId: number,
  monthKey: string
): Promise<number> {
  await assertAdminAccess();
  const override = await getProjectRate(projectId, monthKey);
  if (override !== null) return override;

  const project = await getProject(projectId);
  return project?.defaultDailyRate ?? 0;
}
