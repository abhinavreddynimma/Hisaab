"use server";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Client } from "@/lib/types";

export async function getClients(includeInactive = false): Promise<Client[]> {
  if (includeInactive) {
    return db.select().from(clients).orderBy(clients.name).all() as Client[];
  }
  return db
    .select()
    .from(clients)
    .where(eq(clients.isActive, true))
    .orderBy(clients.name)
    .all() as Client[];
}

export async function getClient(id: number): Promise<Client | null> {
  const client = db.select().from(clients).where(eq(clients.id, id)).get();
  return (client as Client) ?? null;
}

export async function createClient(data: {
  name: string;
  company?: string;
  gstin?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  email?: string;
  phone?: string;
  currency?: string;
}): Promise<{ success: boolean; id?: number }> {
  const result = db
    .insert(clients)
    .values({
      name: data.name,
      company: data.company || null,
      gstin: data.gstin || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      country: data.country || null,
      email: data.email || null,
      phone: data.phone || null,
      currency: data.currency || "EUR",
    })
    .run();

  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function updateClient(
  id: number,
  data: {
    name?: string;
    company?: string;
    gstin?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    email?: string;
    phone?: string;
    currency?: string;
  }
): Promise<{ success: boolean }> {
  db.update(clients)
    .set({
      name: data.name,
      company: data.company || null,
      gstin: data.gstin || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      country: data.country || null,
      email: data.email || null,
      phone: data.phone || null,
      currency: data.currency || "EUR",
    })
    .where(eq(clients.id, id))
    .run();

  return { success: true };
}

export async function toggleClientActive(id: number): Promise<{ success: boolean }> {
  const client = db.select().from(clients).where(eq(clients.id, id)).get();
  if (!client) return { success: false };

  db.update(clients)
    .set({ isActive: !client.isActive })
    .where(eq(clients.id, id))
    .run();

  return { success: true };
}
