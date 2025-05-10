"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Settings,
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
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                isActive
                  ? "text-sidebar-primary"
                  : "text-sidebar-muted group-hover:text-sidebar-foreground/80"
              )}
            />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/20">
        <svg
          className="h-4 w-4 text-sidebar-primary"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="5" y="3" width="4" height="18" rx="2" fill="#f43f5e" />
          <rect x="15" y="3" width="4" height="18" rx="2" fill="#10b981" />
          <rect x="7" y="8" width="10" height="2.5" rx="1.25" fill="currentColor" />
          <rect x="7" y="13.5" width="10" height="2.5" rx="1.25" fill="currentColor" />
        </svg>
      </div>
      <span className="font-display text-base font-bold tracking-tight text-sidebar-accent-foreground">
        Hisaab
      </span>
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
        <SheetContent side="left" className="w-64 bg-sidebar p-0 border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarBrand />
          <div className="mt-4">
            <SidebarNav sessionsEnabled={sessionsEnabled} role={role} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
      <SidebarBrand />
      <div className="mt-4 flex-1 overflow-y-auto">
        <SidebarNav sessionsEnabled={sessionsEnabled} role={role} />
      </div>
    </aside>
  )
}
