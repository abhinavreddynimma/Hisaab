"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LineItemsEditor, type LineItem } from "./line-items-editor";
import { createInvoice, getAutoPopulatedLineItems } from "@/actions/invoices";
import { formatForeignCurrency } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/constants";
import type { Client, Project } from "@/lib/types";

const LUT_NOTE = "Supply meant for export of services under LUT without payment of IGST";

interface InvoiceFormProps {
  clients: Client[];
  projects: (Project & { clientName: string })[];
}

export function InvoiceForm({ clients, projects }: InvoiceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);

  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [billingPeriodStart, setBillingPeriodStart] = useState("");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((p) => p.clientId === parseInt(clientId));
  }, [clientId, projects]);

  const selectedProject = projectId
    ? projects.find((p) => p.id === parseInt(projectId))
    : null;
  const selectedClient = clientId
    ? clients.find((c) => c.id === parseInt(clientId))
    : null;
  const currency = selectedProject?.currency ?? selectedClient?.currency ?? "EUR";

  // When client changes, reset project if it no longer matches
  function handleClientChange(value: string) {
    setClientId(value);
    if (projectId) {
      const currentProject = projects.find(
        (p) => p.id === parseInt(projectId)
      );
      if (currentProject && currentProject.clientId !== parseInt(value)) {
        setProjectId("");
      }
    }
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal; // Export under LUT: IGST 0%

  async function handleAutoPopulate() {
    if (!projectId || !billingPeriodStart || !billingPeriodEnd) {
      toast.error(
        "Please select a project and billing period before auto-populating"
      );
      return;
    }
    setAutoPopulating(true);
    try {
      const items = await getAutoPopulatedLineItems(
        parseInt(projectId),
        billingPeriodStart,
        billingPeriodEnd
      );
      if (items.length === 0) {
        toast.info("No working days found for this period and project");
      } else {
        setLineItems(
          items.map((item) => ({
            description: item.description,
            hsnSac: item.hsnSac,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          }))
        );
        toast.success("Line items populated from time entries");
      }
    } catch {
      toast.error("Failed to auto-populate line items");
    } finally {
      setAutoPopulating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!billingPeriodStart || !billingPeriodEnd) {
      toast.error("Please set the billing period");
      return;
    }
    if (!issueDate) {
      toast.error("Please set the issue date");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createInvoice({
        clientId: parseInt(clientId),
        projectId: projectId ? parseInt(projectId) : null,
        billingPeriodStart,
        billingPeriodEnd,
        issueDate,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        lineItems: lineItems.map((item) => ({
          description: item.description,
          hsnSac: item.hsnSac || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      });

      if (result.success && result.id) {
        toast.success("Invoice created successfully");
        router.push(`/invoices/${result.id}`);
      } else {
        toast.error("Failed to create invoice");
      }
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client & Project */}
      <Card>
        <CardHeader>
          <CardTitle>Client & Project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                      {client.company ? ` (${client.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                      {!clientId ? ` - ${project.clientName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingStart">Billing Period Start</Label>
              <Input
                id="billingStart"
                type="date"
                value={billingPeriodStart}
                onChange={(e) => setBillingPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingEnd">Billing Period End</Label>
              <Input
                id="billingEnd"
                type="date"
                value={billingPeriodEnd}
                onChange={(e) => setBillingPeriodEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoPopulate}
              disabled={autoPopulating}
            >
              {autoPopulating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Auto-populate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <LineItemsEditor items={lineItems} onChange={setLineItems} currency={currency} />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatForeignCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IGST (0%)</span>
              <span>{formatForeignCurrency(0, currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatForeignCurrency(total, currency)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {LUT_NOTE}
          </p>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes (optional)"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
