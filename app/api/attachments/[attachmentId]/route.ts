import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { db } from "@/db";
import { invoiceAttachments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteInvoiceAttachment } from "@/actions/invoices";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const id = parseInt(attachmentId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const attachment = db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.id, id))
    .get();

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(ATTACHMENTS_DIR, attachment.fileName);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const fileBuffer = await readFile(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.originalName}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const id = parseInt(attachmentId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const result = await deleteInvoiceAttachment(id);
  if (!result.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove file from disk
  if (result.fileName) {
    const filePath = path.join(ATTACHMENTS_DIR, result.fileName);
    try {
      await unlink(filePath);
    } catch {
      // File may already be gone
    }
  }

  return NextResponse.json({ success: true });
}
