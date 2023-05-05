"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient, updateClient } from "@/actions/clients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SUPPORTED_CURRENCIES } from "@/lib/constants"
import type { Client } from "@/lib/types"

interface ClientFormProps {
  client?: Client
  onSuccess?: () => void
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const router = useRouter()
  const isEditing = !!client

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(client?.name ?? "")
  const [company, setCompany] = useState(client?.company ?? "")
  const [gstin, setGstin] = useState(client?.gstin ?? "")
  const [addressLine1, setAddressLine1] = useState(client?.addressLine1 ?? "")
  const [addressLine2, setAddressLine2] = useState(client?.addressLine2 ?? "")
  const [city, setCity] = useState(client?.city ?? "")
  const [state, setState] = useState(client?.state ?? "")
  const [pincode, setPincode] = useState(client?.pincode ?? "")
  const [country, setCountry] = useState(client?.country ?? "")
  const [email, setEmail] = useState(client?.email ?? "")
  const [phone, setPhone] = useState(client?.phone ?? "")
  const [currency, setCurrency] = useState(client?.currency ?? "EUR")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Client name is required")
      return
    }

    setLoading(true)

    try {
      const data = {
        name: name.trim(),
        company: company.trim(),
        gstin: gstin.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        country: country.trim(),
        email: email.trim(),
        phone: phone.trim(),
        currency,
      }

      if (isEditing) {
        await updateClient(client.id, data)
        toast.success("Client updated successfully")
        onSuccess?.()
      } else {
        await createClient(data)
        toast.success("Client created successfully")
        router.push("/clients")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="Client name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            placeholder="GSTIN number"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine1">Address Line 1</Label>
            <Input
              id="addressLine1"
              placeholder="Street address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              placeholder="Apartment, suite, etc."
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              placeholder="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update Client"
              : "Create Client"}
        </Button>
      </div>
    </form>
  )
}
