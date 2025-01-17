"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updatePaymentDetails } from "@/actions/invoices";
import type { Invoice } from "@/lib/types";

interface PaymentDetailsProps {
  invoice: Invoice;
}

export function PaymentDetails({ invoice }: PaymentDetailsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paidDate, setPaidDate] = useState(invoice.paidDate ?? "");
  const [eurToInrRate, setEurToInrRate] = useState(String(invoice.eurToInrRate ?? ""));
  const [platformCharges, setPlatformCharges] = useState(String(invoice.platformCharges ?? 0));
  const [bankCharges, setBankCharges] = useState(String(invoice.bankCharges ?? 0));

  const rate = parseFloat(eurToInrRate) || 0;
  const grossInr = invoice.total * rate;
  const netInr = grossInr - (parseFloat(platformCharges) || 0) - (parseFloat(bankCharges) || 0);

  async function handleSave() {
    if (!rate || rate <= 0) {
      toast.error("Please enter a valid EUR to INR rate");
      return;
    }
    setSaving(true);
    try {
      const result = await updatePaymentDetails(invoice.id, {
        paidDate: paidDate || null,
        eurToInrRate: rate,
        platformCharges: parseFloat(platformCharges) || 0,
        bankCharges: parseFloat(bankCharges) || 0,
        netInrAmount: netInr,
      });
      if (result.success) {
        toast.success("Payment details updated");
        setEditing(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update payment details");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPaidDate(invoice.paidDate ?? "");
    setEurToInrRate(String(invoice.eurToInrRate ?? ""));
    setPlatformCharges(String(invoice.platformCharges ?? 0));
    setBankCharges(String(invoice.bankCharges ?? 0));
    setEditing(false);
  }

  if (!invoice.eurToInrRate) return null;

  return (
    <div className="no-print">
      <Separator />
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Payment Details
          </h3>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="h-7 text-xs text-muted-foreground"
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 rounded-md border p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Date</Label>
                <Input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">EUR to INR Rate</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={eurToInrRate}
                  onChange={(e) => setEurToInrRate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Platform Charges (INR)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={platformCharges}
                  onChange={(e) => setPlatformCharges(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bank Charges (INR)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={bankCharges}
                  onChange={(e) => setBankCharges(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gross INR</span>
              <span className="font-medium">{formatCurrency(grossInr)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Net INR Realized</span>
              <span className="font-bold">{formatCurrency(netInr)}</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {invoice.paidDate && (
              <>
                <span className="text-gray-500">Payment Date</span>
                <span className="text-right font-medium">{formatDate(invoice.paidDate)}</span>
              </>
            )}
            <span className="text-gray-500">EUR to INR Rate</span>
            <span className="text-right font-medium">{invoice.eurToInrRate}</span>
            <span className="text-gray-500">Gross INR</span>
            <span className="text-right font-medium">
              {formatCurrency(invoice.total * invoice.eurToInrRate!)}
            </span>
            {(invoice.platformCharges ?? 0) > 0 && (
              <>
                <span className="text-gray-500">Platform Charges</span>
                <span className="text-right text-red-600">
                  -{formatCurrency(invoice.platformCharges!)}
                </span>
              </>
            )}
            {(invoice.bankCharges ?? 0) > 0 && (
              <>
                <span className="text-gray-500">Bank Charges</span>
                <span className="text-right text-red-600">
                  -{formatCurrency(invoice.bankCharges!)}
                </span>
              </>
            )}
            {invoice.netInrAmount != null && (
              <>
                <span className="font-semibold text-gray-700">Net INR Realized</span>
                <span className="text-right font-bold">
                  {formatCurrency(invoice.netInrAmount)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
