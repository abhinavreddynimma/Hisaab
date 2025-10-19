"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createProject } from "@/actions/projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from "@/lib/constants"

interface ProjectFormProps {
  clientId: number
  clientCurrency?: string
  onSuccess?: () => void
}

export function ProjectForm({ clientId, clientCurrency = "EUR", onSuccess }: ProjectFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [defaultDailyRate, setDefaultDailyRate] = useState("")
  const [currency, setCurrency] = useState(clientCurrency)

  function resetForm() {
    setName("")
    setDefaultDailyRate("")
    setCurrency(clientCurrency)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Project name is required")
      return
    }

    const rate = parseFloat(defaultDailyRate)
    if (isNaN(rate) || rate <= 0) {
      toast.error("Please enter a valid daily rate")
      return
    }

    setLoading(true)

    try {
      await createProject({
        clientId,
        name: name.trim(),
        defaultDailyRate: rate,
        currency,
      })
      toast.success("Project created successfully")
      resetForm()
      setOpen(false)
      onSuccess?.()
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Add a new project for this client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              placeholder="e.g. Web Development"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
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
                    {c.symbol} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultDailyRate">Default Daily Rate ({getCurrencySymbol(currency)}) *</Label>
            <Input
              id="defaultDailyRate"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={defaultDailyRate}
              onChange={(e) => setDefaultDailyRate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
