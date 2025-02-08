"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toggleClientActive } from "@/actions/clients"
import { toggleProjectActive } from "@/actions/projects"
import { ClientForm } from "@/components/clients/client-form"
import { ProjectForm } from "@/components/clients/project-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Pencil } from "lucide-react"
import { formatForeignCurrency } from "@/lib/utils"
import { getCurrencySymbol } from "@/lib/constants"
import type { Client, Project } from "@/lib/types"

interface ClientDetailsProps {
  client: Client
  projects: Project[]
}

export function ClientDetails({ client, projects }: ClientDetailsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  function formatAddress() {
    const parts = [
      client.addressLine1,
      client.addressLine2,
      client.city,
      client.state,
      client.pincode,
      client.country,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(", ") : "-"
  }

  async function handleToggleProject(project: Project) {
    try {
      await toggleProjectActive(project.id)
      toast.success(
        project.isActive
          ? `${project.name} has been deactivated`
          : `${project.name} has been activated`
      )
      router.refresh()
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
  }

  async function handleToggleClient() {
    try {
      await toggleClientActive(client.id)
      toast.success(
        client.isActive
          ? `${client.name} has been deactivated`
          : `${client.name} has been activated`
      )
      router.refresh()
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Client Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{client.name}</CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                {getCurrencySymbol(client.currency)} {client.currency}
              </Badge>
              {client.isActive ? (
                <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            {client.company && (
              <CardDescription>{client.company}</CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Client</DialogTitle>
                  <DialogDescription>
                    Update the client details below.
                  </DialogDescription>
                </DialogHeader>
                <ClientForm
                  client={client}
                  onSuccess={() => {
                    setEditOpen(false)
                    router.refresh()
                  }}
                />
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleClient}
            >
              {client.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 text-sm">{client.email ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Phone
              </dt>
              <dd className="mt-1 text-sm">{client.phone ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                GSTIN
              </dt>
              <dd className="mt-1 text-sm">{client.gstin ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Address
              </dt>
              <dd className="mt-1 text-sm">{formatAddress()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Projects Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription className="mt-1.5">
              Manage projects for this client.
            </CardDescription>
          </div>
          <ProjectForm
            clientId={client.id}
            clientCurrency={client.currency}
            onSuccess={() => router.refresh()}
          />
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No projects yet. Add one to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Daily Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      {project.name}
                    </TableCell>
                    <TableCell>
                      {formatForeignCurrency(project.defaultDailyRate, project.currency)}
                    </TableCell>
                    <TableCell>
                      {project.isActive ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleProject(project)}
                      >
                        {project.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
