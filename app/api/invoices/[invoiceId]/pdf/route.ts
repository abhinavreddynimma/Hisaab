import { NextRequest, NextResponse } from "next/server";

// PDF generation endpoint - initially returns a redirect to the invoice page for browser print
// Can be enhanced later with @react-pdf/renderer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  // For now, redirect to the invoice preview page which can be printed
  return NextResponse.redirect(
    new URL(`/invoices/${invoiceId}`, request.url)
  );
}
