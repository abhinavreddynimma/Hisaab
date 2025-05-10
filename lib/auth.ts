import "server-only";

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { settings, sessions, users } from "@/db/schema";
import type { AuthRole, AuthUser } from "@/lib/types";

const SESSION_COOKIE_NAME = "hisaab_session";
const ACCESS_CONTROL_KEY = "access_control";
const SESSION_DURATION_DAYS = 30;
const PASSWORD_ALGO = "scrypt-v1";

interface AccessControlConfig {
  sessionsEnabled: boolean;
}

interface RequirePageAccessOptions {
  allowViewer?: boolean;
}

const DEFAULT_ACCESS_CONTROL_CONFIG: AccessControlConfig = {
  sessionsEnabled: false,
};

function parseAccessControlConfig(value: string | undefined): AccessControlConfig {
  if (!value) return DEFAULT_ACCESS_CONTROL_CONFIG;
  try {
    const parsed = JSON.parse(value) as Partial<AccessControlConfig>;
    return {
      sessionsEnabled: Boolean(parsed.sessionsEnabled),
    };
  } catch {
    return DEFAULT_ACCESS_CONTROL_CONFIG;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDurationToNow(days = 0, hours = 0): Date {
  const date = new Date();
  if (days > 0) date.setDate(date.getDate() + days);
  if (hours > 0) date.setHours(date.getHours() + hours);
  return date;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_ALGO}$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algo, salt, hash] = storedHash.split("$");
  if (algo !== PASSWORD_ALGO || !salt || !hash) return false;
  const attempted = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempted, "hex"));
}

function toAuthUser(row: {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  tag: string | null;
  isActive: boolean;
  createdAt: string;
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tag: row.tag,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

async function upsertAccessControlConfig(config: AccessControlConfig): Promise<void> {
  const existing = db.select().from(settings).where(eq(settings.key, ACCESS_CONTROL_KEY)).get();
  const value = JSON.stringify(config);
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.key, ACCESS_CONTROL_KEY)).run();
    return;
  }
  db.insert(settings).values({ key: ACCESS_CONTROL_KEY, value }).run();
}

async function cleanupExpiredSessions(): Promise<void> {
  db.delete(sessions).where(lte(sessions.expiresAt, nowIso())).run();
}

export async function getAccessControlConfig(): Promise<AccessControlConfig> {
  const row = db.select().from(settings).where(eq(settings.key, ACCESS_CONTROL_KEY)).get();
  return parseAccessControlConfig(row?.value);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const config = await getAccessControlConfig();
  if (!config.sessionsEnabled) return null;

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const row = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tag: users.tag,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, nowIso()),
        eq(users.isActive, true)
      )
    )
    .get();

  if (!row) return null;
  return toAuthUser(row as AuthUser);
}

export async function getAuthContext(): Promise<{
  sessionsEnabled: boolean;
  user: AuthUser | null;
}> {
  const config = await getAccessControlConfig();
  if (!config.sessionsEnabled) {
    return { sessionsEnabled: false, user: null };
  }
  const user = await getCurrentUser();
  return { sessionsEnabled: true, user };
}

export async function assertAuthenticatedAccess(): Promise<AuthUser | null> {
  const context = await getAuthContext();
  if (!context.sessionsEnabled) return null;
  if (!context.user) {
    throw new Error("Authentication required");
  }
  return context.user;
}

export async function assertAdminAccess(): Promise<AuthUser | null> {
  const user = await assertAuthenticatedAccess();
  if (!user) return null;
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

export async function requirePageAccess(
  options: RequirePageAccessOptions = {}
): Promise<{ sessionsEnabled: boolean; user: AuthUser | null }> {
  const { allowViewer = false } = options;
  const context = await getAuthContext();
  if (!context.sessionsEnabled) {
    return context;
  }
  if (!context.user) {
    redirect("/login");
  }
  if (!allowViewer && context.user.role !== "admin") {
    redirect("/dashboard");
  }
  return context;
}

export async function getAccessControlStatus(): Promise<{
  sessionsEnabled: boolean;
  hasAdminUser: boolean;
}> {
  const config = await getAccessControlConfig();
  const adminRow = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .get();

  return {
    sessionsEnabled: config.sessionsEnabled,
    hasAdminUser: Boolean(adminRow),
  };
}

export async function createAdminAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  const { name, email, password } = input;
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!trimmedName) {
    throw new Error("Name is required");
  }
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existingAdmin = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .get();
  if (existingAdmin) {
    throw new Error("Admin account already exists");
  }

  const existingUser = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get();
  if (existingUser) {
    throw new Error("Email is already in use");
  }

  const result = db
    .insert(users)
    .values({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: "admin",
      isActive: true,
      createdAt: nowIso(),
    })
    .run();

  await upsertAccessControlConfig({ sessionsEnabled: true });

  const created = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tag: users.tag,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, Number(result.lastInsertRowid)))
    .get();

  if (!created) {
    throw new Error("Failed to create admin account");
  }
  return toAuthUser(created as AuthUser);
}

export async function authenticateWithCredentials(input: {
  email: string;
  password: string;
}): Promise<AuthUser | null> {
  const config = await getAccessControlConfig();
  if (!config.sessionsEnabled) return null;

  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail || !input.password) return null;

  const row = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tag: users.tag,
      isActive: users.isActive,
      createdAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get() as (AuthUser & { passwordHash: string }) | undefined;

  if (!row || !row.isActive) return null;
  if (!verifyPassword(input.password, row.passwordHash)) return null;

  return toAuthUser(row);
}

export async function createSessionForUser(userId: number): Promise<void> {
  const token = createRandomToken();
  const tokenHash = hashToken(token);
  const expiresAt = addDurationToNow(SESSION_DURATION_DAYS, 0);

  await cleanupExpiredSessions();
  db.insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: nowIso(),
    })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function listViewerAccounts(): Promise<AuthUser[]> {
  const config = await getAccessControlConfig();
  if (!config.sessionsEnabled) {
    return [];
  }
  await assertAdminAccess();

  const rows = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tag: users.tag,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "viewer"))
    .all();

  return rows.map((row) => toAuthUser(row as AuthUser));
}

export async function createViewerAccount(input: {
  name: string;
  email: string;
  password: string;
  tag?: string;
}): Promise<AuthUser> {
  const config = await getAccessControlConfig();
  if (!config.sessionsEnabled) {
    throw new Error("Complete admin setup first");
  }

  const trimmedName = input.name.trim();
  const normalizedEmail = normalizeEmail(input.email);
  if (!trimmedName) {
    throw new Error("Name is required");
  }
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .get();
  if (existing) {
    throw new Error("Email is already in use");
  }

  const result = db
    .insert(users)
    .values({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      role: "viewer",
      tag: input.tag?.trim() || null,
      isActive: true,
      createdAt: nowIso(),
    })
    .run();

  const created = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tag: users.tag,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, Number(result.lastInsertRowid)))
    .get();
  if (!created) {
    throw new Error("Failed to create viewer account");
  }
  return toAuthUser(created as AuthUser);
}

export async function setViewerAccountStatus(
  viewerUserId: number,
  isActive: boolean
): Promise<boolean> {
  const row = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, viewerUserId), eq(users.role, "viewer")))
    .get();
  if (!row) return false;

  db.update(users).set({ isActive }).where(eq(users.id, viewerUserId)).run();
  return true;
}
