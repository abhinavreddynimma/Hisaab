"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceDetailActions() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline">
        <Link href="/invoices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Link>
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
