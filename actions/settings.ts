"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserProfile, LeavePolicy, InvoiceSettings } from "@/lib/types";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  return JSON.parse(row.value) as T;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const jsonValue = JSON.stringify(value);
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value: jsonValue }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value: jsonValue }).run();
  }
}

export async function getUserProfile(): Promise<UserProfile> {
  await assertAuthenticatedAccess();
  const profile = await getSetting<UserProfile>("user_profile");
  return profile ?? {
    name: "",
    company: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "",
    gstin: "",
    pan: "",
    email: "",
    phone: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    bankBranch: "",
    bankIban: "",
    bankBic: "",
    sepaAccountName: "",
    sepaIban: "",
    sepaBic: "",
    sepaBank: "",
    sepaAccountType: "",
    sepaAddress: "",
    swiftAccountName: "",
    swiftIban: "",
    swiftBic: "",
    swiftBank: "",
    swiftAccountType: "",
  };
}

export async function saveUserProfile(profile: UserProfile): Promise<{ success: boolean }> {
  await assertAdminAccess();
  await setSetting("user_profile", profile);
  return { success: true };
}

export async function getLeavePolicy(): Promise<LeavePolicy> {
  await assertAuthenticatedAccess();
  const policy = await getSetting<LeavePolicy>("leave_policy");
  return policy ?? {
    leavesPerMonth: 1,
    standardWorkingDays: 22,
    trackingStartDate: "2025-05",
  };
}

export async function saveLeavePolicy(policy: LeavePolicy): Promise<{ success: boolean }> {
  await assertAdminAccess();
  await setSetting("leave_policy", policy);
  return { success: true };
}

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  await assertAuthenticatedAccess();
  const invoiceSettings = await getSetting<InvoiceSettings>("invoice_settings");
  return invoiceSettings ?? {
    prefix: "INV",
    nextNumber: 1,
    defaultHsnSac: "998314",
    defaultTaxRate: 18,
    taxType: "cgst_sgst",
  };
}

export async function saveInvoiceSettings(invoiceSettingsData: InvoiceSettings): Promise<{ success: boolean }> {
  await assertAdminAccess();
  await setSetting("invoice_settings", invoiceSettingsData);
  return { success: true };
}

export async function getDefaultProjectId(): Promise<number | null> {
  await assertAuthenticatedAccess();
  const setting = await getSetting<{ projectId: number | null }>("default_project");
  return setting?.projectId ?? null;
}

export async function saveDefaultProjectId(projectId: number | null): Promise<{ success: boolean }> {
  await assertAdminAccess();
  await setSetting("default_project", { projectId });
  return { success: true };
}
