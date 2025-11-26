"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Settings,
  Wallet,
  IndianRupee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AuthRole } from "@/lib/types"

const fullNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Tax", href: "/tax", icon: IndianRupee },
  { label: "Settings", href: "/settings", icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  mobile?: boolean
  sessionsEnabled?: boolean
  role?: AuthRole
}

function SidebarNav({
  sessionsEnabled,
  role,
}: {
  sessionsEnabled: boolean
  role?: AuthRole
}) {
  const pathname = usePathname()
  const navItems =
    sessionsEnabled && role === "viewer"
      ? fullNavItems.filter((item) => item.href === "/dashboard" || item.href === "/invoices")
      : fullNavItems

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/")
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="flex h-16 items-center gap-2 border-b border-border px-6">
      <Wallet className="h-6 w-6 text-primary" />
      <span className="text-lg font-semibold tracking-tight">Payroll</span>
    </div>
  )
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobile = false,
  sessionsEnabled = false,
  role,
}: SidebarProps) {
  if (mobile) {
    return (
      <Sheet open={collapsed} onOpenChange={onToggle}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarHeader />
          <div className="mt-4">
            <SidebarNav sessionsEnabled={sessionsEnabled} role={role} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-border">
      <SidebarHeader />
      <div className="mt-4 flex-1 overflow-y-auto">
        <SidebarNav sessionsEnabled={sessionsEnabled} role={role} />
      </div>
    </aside>
  )
}
