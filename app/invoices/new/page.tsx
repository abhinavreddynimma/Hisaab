import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getClients } from "@/actions/clients";
import { getActiveProjects } from "@/actions/projects";

export default async function NewInvoicePage() {
  const [clients, projects] = await Promise.all([
    getClients(),
    getActiveProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to invoices</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
      </div>
      <InvoiceForm clients={clients} projects={projects} />
    </div>
  );
}
