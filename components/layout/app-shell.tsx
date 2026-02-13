"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import type { AuthUser } from "@/lib/types"

interface AppShellProps {
  children: React.ReactNode
  authState: {
    sessionsEnabled: boolean
    user: AuthUser | null
  }
}

export function AppShell({ children, authState }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const normalizedPath = pathname?.replace(/^\/hisaab/, "") ?? ""
  const isAuthPage = normalizedPath === "/login"

  if (isAuthPage) {
    return <main className="min-h-screen p-4 lg:p-6">{children}</main>
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <div className="no-print">
        <Sidebar
          sessionsEnabled={authState.sessionsEnabled}
          role={authState.user?.role}
        />
      </div>

      {/* Mobile sidebar (sheet overlay) */}
      <Sidebar
        mobile
        collapsed={mobileOpen}
        onToggle={() => setMobileOpen(false)}
        sessionsEnabled={authState.sessionsEnabled}
        role={authState.user?.role}
      />

      {/* Main content area offset by sidebar on desktop */}
      <div className="lg:pl-64">
        <div className="no-print">
          <Header
            onMenuToggle={() => setMobileOpen(true)}
            sessionsEnabled={authState.sessionsEnabled}
            user={authState.user}
          />
        </div>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
