import Link from "next/link"
import { notFound } from "next/navigation"
import { getClient } from "@/actions/clients"
import { getProjectsByClient } from "@/actions/projects"
import { ClientDetails } from "@/components/clients/client-details"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { requirePageAccess } from "@/lib/auth"

interface ClientPageProps {
  params: Promise<{ clientId: string }>
}

export default async function ClientPage({ params }: ClientPageProps) {
  await requirePageAccess()

  const { clientId } = await params
  const id = parseInt(clientId, 10)

  if (isNaN(id)) {
    notFound()
  }

  const client = await getClient(id)

  if (!client) {
    notFound()
  }

  const projects = await getProjectsByClient(id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to clients</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      </div>

      <ClientDetails client={client} projects={projects} />
    </div>
  )
}
