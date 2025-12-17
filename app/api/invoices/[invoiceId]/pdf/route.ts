import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticatedAccess } from "@/lib/auth";

// PDF generation endpoint - initially returns a redirect to the invoice page for browser print
// Can be enhanced later with @react-pdf/renderer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await assertAuthenticatedAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await params;

  // For now, redirect to the invoice preview page which can be printed
  return NextResponse.redirect(
    new URL(`/invoices/${invoiceId}`, request.url)
  );
}
