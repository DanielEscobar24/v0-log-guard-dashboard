"use client"

import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <main className="lg:ml-[260px] min-h-screen pb-20 lg:pb-0">
        {children}
      </main>
      
      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  )
}
