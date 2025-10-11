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
import { saveUserProfile } from "@/actions/settings";
import type { UserProfile } from "@/lib/types";

interface UserDetailsFormProps {
  initialData: UserProfile;
}

export function UserDetailsForm({ initialData }: UserDetailsFormProps) {
  const [formData, setFormData] = useState<UserProfile>(initialData);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveUserProfile(formData);
      if (result.success) {
        toast.success("Profile saved successfully");
      }
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="Company or business name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Phone number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={(e) => handleChange("addressLine1", e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={(e) => handleChange("addressLine2", e.target.value)}
              placeholder="Apartment, suite, etc."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={formData.pincode}
                onChange={(e) => handleChange("pincode", e.target.value)}
                placeholder="Pincode"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="Country"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => handleChange("gstin", e.target.value)}
                placeholder="GST Identification Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN</Label>
              <Input
                id="pan"
                value={formData.pan}
                onChange={(e) => handleChange("pan", e.target.value)}
                placeholder="Permanent Account Number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domestic Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankBranch">Branch</Label>
              <Input
                id="bankBranch"
                value={formData.bankBranch}
                onChange={(e) => handleChange("bankBranch", e.target.value)}
                placeholder="Branch name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bankAccount">Account Number</Label>
              <Input
                id="bankAccount"
                value={formData.bankAccount}
                onChange={(e) => handleChange("bankAccount", e.target.value)}
                placeholder="Account number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankIfsc">IFSC Code</Label>
              <Input
                id="bankIfsc"
                value={formData.bankIfsc}
                onChange={(e) => handleChange("bankIfsc", e.target.value)}
                placeholder="IFSC code"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SEPA Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sepaAccountName">Account Name</Label>
              <Input
                id="sepaAccountName"
                value={formData.sepaAccountName}
                onChange={(e) => handleChange("sepaAccountName", e.target.value)}
                placeholder="Account holder name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sepaIban">IBAN</Label>
              <Input
                id="sepaIban"
                value={formData.sepaIban}
                onChange={(e) => handleChange("sepaIban", e.target.value)}
                placeholder="e.g. GB05TCCL00997981184873"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sepaBic">SWIFT/BIC Code</Label>
              <Input
                id="sepaBic"
                value={formData.sepaBic}
                onChange={(e) => handleChange("sepaBic", e.target.value)}
                placeholder="e.g. TCCLGB31"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sepaBank">Bank</Label>
              <Input
                id="sepaBank"
                value={formData.sepaBank}
                onChange={(e) => handleChange("sepaBank", e.target.value)}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sepaAccountType">Account Type</Label>
              <Input
                id="sepaAccountType"
                value={formData.sepaAccountType}
                onChange={(e) => handleChange("sepaAccountType", e.target.value)}
                placeholder="e.g. Business"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sepaAddress">Address</Label>
              <Input
                id="sepaAddress"
                value={formData.sepaAddress}
                onChange={(e) => handleChange("sepaAddress", e.target.value)}
                placeholder="Bank address"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SWIFT Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="swiftAccountName">Account Name</Label>
              <Input
                id="swiftAccountName"
                value={formData.swiftAccountName}
                onChange={(e) => handleChange("swiftAccountName", e.target.value)}
                placeholder="Account holder name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swiftIban">IBAN</Label>
              <Input
                id="swiftIban"
                value={formData.swiftIban}
                onChange={(e) => handleChange("swiftIban", e.target.value)}
                placeholder="e.g. GB09TCCL04140469583262"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swiftBic">SWIFT/BIC Code</Label>
              <Input
                id="swiftBic"
                value={formData.swiftBic}
                onChange={(e) => handleChange("swiftBic", e.target.value)}
                placeholder="e.g. TCCLGB3L"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swiftBank">Bank</Label>
              <Input
                id="swiftBank"
                value={formData.swiftBank}
                onChange={(e) => handleChange("swiftBank", e.target.value)}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="swiftAccountType">Account Type</Label>
              <Input
                id="swiftAccountType"
                value={formData.swiftAccountType}
                onChange={(e) => handleChange("swiftAccountType", e.target.value)}
                placeholder="e.g. Business"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}
