"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Shield } from "lucide-react"

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between bg-card px-6 text-card-foreground lg:justify-end">
      <div className="flex items-center gap-3 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent">
          <Shield className="h-5 w-5 text-sidebar-primary" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">LogGuard</h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Observabilidad de red</p>
        </div>
      </div>

      <div className="lg:hidden">
        <ThemeToggle />
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        <ThemeToggle />
      </div>
    </header>
  )
}
