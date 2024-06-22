"use server";

import { revalidatePath } from "next/cache";
import {
  assertAdminAccess,
  createAdminAccount,
  createSessionForUser,
  createViewerAccount,
  authenticateWithCredentials,
  clearCurrentSession,
  setViewerAccountStatus,
} from "@/lib/auth";

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await authenticateWithCredentials(input);
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }
  await createSessionForUser(user.id);
  return { success: true };
}

export async function logoutUser(): Promise<{ success: boolean }> {
  await clearCurrentSession();
  return { success: true };
}

export async function createAdmin(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await createAdminAccount(input);
    await createSessionForUser(adminUser.id);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create admin account";
    return { success: false, error: message };
  }
}

export async function createViewerUser(input: {
  name: string;
  email: string;
  password: string;
  tag?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminAccess();
    await createViewerAccount(input);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create viewer account";
    return { success: false, error: message };
  }
}

export async function updateViewerStatus(input: {
  userId: number;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdminAccess();
    const success = await setViewerAccountStatus(input.userId, input.isActive);
    if (!success) {
      return { success: false, error: "Viewer account not found" };
    }
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update viewer account";
    return { success: false, error: message };
  }
}
