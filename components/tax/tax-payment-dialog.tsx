"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TAX_QUARTERS } from "@/lib/constants";
import { createTaxPayment, updateTaxPayment } from "@/actions/tax-payments";
import type { TaxPayment, TaxQuarter } from "@/lib/types";

interface TaxPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  payment: TaxPayment | null;
  financialYear: string;
}

export function TaxPaymentDialog({ open, onClose, payment, financialYear }: TaxPaymentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [fy, setFy] = useState(financialYear);
  const [quarter, setQuarter] = useState<TaxQuarter>("Q1");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (payment) {
      setFy(payment.financialYear);
      setQuarter(payment.quarter);
      setAmount(String(payment.amount));
      setPaymentDate(payment.paymentDate);
      setChallanNo(payment.challanNo || "");
      setNotes(payment.notes || "");
    } else {
      setFy(financialYear);
      setQuarter("Q1");
      setAmount("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setChallanNo("");
      setNotes("");
    }
  }, [payment, financialYear, open]);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!paymentDate) {
      toast.error("Please select the payment date");
      return;
    }

    setSaving(true);
    try {
      const data = {
        financialYear: fy,
        quarter,
        amount: amt,
        paymentDate,
        challanNo: challanNo || undefined,
        notes: notes || undefined,
      };

      if (payment) {
        const result = await updateTaxPayment(payment.id, data);
        if (result.success) {
          toast.success("Tax payment updated");
          onClose();
        }
      } else {
        const result = await createTaxPayment(data);
        if (result.success) {
          toast.success("Tax payment added");
          onClose();
        }
      }
    } catch {
      toast.error("Failed to save tax payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? "Edit" : "Add"} Tax Payment</DialogTitle>
          <DialogDescription>
            Record an advance tax payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Input value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2025-26" />
            </div>
            <div className="space-y-2">
              <Label>Quarter</Label>
              <Select value={quarter} onValueChange={(v) => setQuarter(v as TaxQuarter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAX_QUARTERS) as TaxQuarter[]).map((q) => (
                    <SelectItem key={q} value={q}>
                      {TAX_QUARTERS[q].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Challan Number</Label>
            <Input
              value={challanNo}
              onChange={(e) => setChallanNo(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : payment ? "Update" : "Add Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
