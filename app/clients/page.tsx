import Link from "next/link"
import { getClients } from "@/actions/clients"
import { ClientList } from "@/components/clients/client-list"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function ClientsPage() {
  const clients = await getClients(true)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </Button>
      </div>

      <ClientList clients={clients} />
    </div>
  )
}
