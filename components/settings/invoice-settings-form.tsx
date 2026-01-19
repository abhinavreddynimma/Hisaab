"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { saveInvoiceSettings } from "@/actions/settings";
import type { InvoiceSettings } from "@/lib/types";

interface InvoiceSettingsFormProps {
  initialData: InvoiceSettings;
}

export function InvoiceSettingsForm({ initialData }: InvoiceSettingsFormProps) {
  const [formData, setFormData] = useState<InvoiceSettings>(initialData);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string | number) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveInvoiceSettings(formData);
      if (result.success) {
        toast.success("Invoice settings saved successfully");
      }
    } catch {
      toast.error("Failed to save invoice settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Numbering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prefix">Invoice Prefix</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) => handleChange("prefix", e.target.value)}
                placeholder="e.g. INV"
              />
              <p className="text-sm text-muted-foreground">
                Prefix used for generated invoice numbers (e.g. INV-001).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextNumber">Next Invoice Number</Label>
              <Input
                id="nextNumber"
                type="number"
                min={1}
                value={formData.nextNumber}
                onChange={(e) =>
                  handleChange("nextNumber", parseInt(e.target.value, 10) || 1)
                }
                placeholder="Next sequential number"
              />
              <p className="text-sm text-muted-foreground">
                The next number to be used when generating an invoice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="defaultHsnSac">Default HSN/SAC Code</Label>
              <Input
                id="defaultHsnSac"
                value={formData.defaultHsnSac}
                onChange={(e) => handleChange("defaultHsnSac", e.target.value)}
                placeholder="e.g. 998314"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
              <Input
                id="defaultTaxRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={formData.defaultTaxRate}
                onChange={(e) =>
                  handleChange(
                    "defaultTaxRate",
                    parseFloat(e.target.value) || 0
                  )
                }
                placeholder="e.g. 18"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxType">Tax Type</Label>
              <Select
                value={formData.taxType}
                onValueChange={(value) => handleChange("taxType", value)}
              >
                <SelectTrigger id="taxType">
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cgst_sgst">CGST + SGST</SelectItem>
                  <SelectItem value="igst">IGST</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                CGST+SGST for intra-state, IGST for inter-state transactions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Invoice Settings"}
        </Button>
      </div>
    </form>
  );
}
