"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Download, Loader2 } from "lucide-react";
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
import type { TaxPayment, TaxPaymentAttachment, TaxQuarter } from "@/lib/types";

interface TaxPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  payment: TaxPayment | null;
  financialYear: string;
  attachments?: TaxPaymentAttachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaxPaymentDialog({ open, onClose, payment, financialYear, attachments }: TaxPaymentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [fy, setFy] = useState(financialYear);
  const [quarter, setQuarter] = useState<TaxQuarter>("Q1");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [notes, setNotes] = useState("");

  // Attachment state
  const [currentAttachments, setCurrentAttachments] = useState<TaxPaymentAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileLabel, setFileLabel] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setCurrentAttachments(attachments || []);
    setFileLabel("");
  }, [payment, financialYear, open, attachments]);

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

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!payment) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (fileLabel.trim()) {
        formData.append("label", fileLabel.trim());
      }

      const response = await fetch(`/hisaab/api/tax-payments/${payment.id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      setCurrentAttachments((prev) => [
        {
          id: result.id,
          taxPaymentId: payment.id,
          fileName: "",
          originalName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          label: fileLabel.trim() || null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setFileLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("File uploaded");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: number) {
    setDeletingId(attachmentId);
    try {
      const response = await fetch(`/hisaab/api/tax-attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");

      setCurrentAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
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

          {/* Attachments - only shown when editing an existing payment */}
          {payment && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium">Attachments</Label>
              <div className="flex gap-2">
                <Input type="file" ref={fileInputRef} className="text-sm flex-1" />
                <Input
                  value={fileLabel}
                  onChange={(e) => setFileLabel(e.target.value)}
                  placeholder="Label"
                  className="text-sm w-24"
                />
                <Button type="button" size="sm" disabled={uploading} onClick={handleUpload}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
              {currentAttachments.length > 0 ? (
                <div className="divide-y rounded-md border">
                  {currentAttachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm">{att.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(att.fileSize)}
                            {att.label && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5">{att.label}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`/hisaab/api/tax-attachments/${att.id}`} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={deletingId === att.id}
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          {deletingId === att.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No attachments. Upload challan receipts or documents.</p>
              )}
            </div>
          )}
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
