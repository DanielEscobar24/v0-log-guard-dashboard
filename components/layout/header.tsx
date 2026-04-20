"use client"

import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarContent } from "@/components/layout/sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)")
    const onChange = () => {
      if (mql.matches) setSidebarOpen(false)
    }
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return (
    <header className="h-16 bg-card text-card-foreground flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="lg:hidden p-0 w-[260px] bg-sidebar border-border/40">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="h-full">
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile: keep theme toggle accessible */}
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>

      {/* Right Actions */}
      <div className="hidden md:flex items-center gap-3">
        <ThemeToggle />

        <div className="flex items-center gap-2 pl-3">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">System Root</p>
          </div>
          <Avatar className="w-9 h-9">
            <AvatarImage src="/placeholder-user.jpg" alt="Admin" />
            <AvatarFallback className="bg-primary/15 text-primary text-sm">A</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
