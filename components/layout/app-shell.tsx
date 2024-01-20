"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <div className="no-print">
        <Sidebar />
      </div>

      {/* Mobile sidebar (sheet overlay) */}
      <Sidebar
        mobile
        collapsed={mobileOpen}
        onToggle={() => setMobileOpen(false)}
      />

      {/* Main content area offset by sidebar on desktop */}
      <div className="lg:pl-64">
        <div className="no-print">
          <Header onMenuToggle={() => setMobileOpen(true)} />
        </div>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
