import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { addInvoiceAttachment } from "@/actions/invoices";
import { assertAdminAccess } from "@/lib/auth";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await assertAdminAccess();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invoiceId } = await params;
  const id = parseInt(invoiceId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = formData.get("label") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Generate unique filename
  const ext = path.extname(file.name);
  const fileName = `${randomUUID()}${ext}`;

  // Ensure directory exists
  await mkdir(ATTACHMENTS_DIR, { recursive: true });

  // Write file to disk
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(path.join(ATTACHMENTS_DIR, fileName), buffer);

  // Save metadata to DB
  const result = await addInvoiceAttachment({
    invoiceId: id,
    fileName,
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    label: label || undefined,
  });

  return NextResponse.json(result);
}
