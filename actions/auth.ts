"use server";

import { revalidatePath } from "next/cache";
import {
  assertAdminAccess,
  createInitialAdminFromSetupToken,
  createSessionForUser,
  createSetupToken,
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

export async function createShareableSetupLink(): Promise<{
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
}> {
  try {
    const result = await createSetupToken();
    return { success: true, token: result.token, expiresAt: result.expiresAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create shareable link";
    return { success: false, error: message };
  }
}

export async function completeSetup(input: {
  token: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const adminUser = await createInitialAdminFromSetupToken(input);
    await createSessionForUser(adminUser.id);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete setup";
    return { success: false, error: message };
  }
}

export async function createViewerUser(input: {
  name: string;
  email: string;
  password: string;
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
