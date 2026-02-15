import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { addTaxPaymentAttachment } from "@/actions/tax-payments";
import { assertAdminAccess } from "@/lib/auth";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    await assertAdminAccess();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { paymentId } = await params;
  const id = parseInt(paymentId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = formData.get("label") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = path.extname(file.name);
  const fileName = `${randomUUID()}${ext}`;

  await mkdir(ATTACHMENTS_DIR, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(path.join(ATTACHMENTS_DIR, fileName), buffer);

  const result = await addTaxPaymentAttachment({
    taxPaymentId: id,
    fileName,
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    label: label || undefined,
  });

  return NextResponse.json(result);
}
