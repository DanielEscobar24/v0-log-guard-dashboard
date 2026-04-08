"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, AlertTriangle, Globe, Menu } from "lucide-react"

const navItems = [
  { href: "/", label: "HOME", icon: LayoutDashboard },
  { href: "/live-logs", label: "LOGS", icon: FileText },
  { href: "/alerts", label: "ALERTS", icon: AlertTriangle },
  { href: "/maps", label: "MAPS", icon: Globe },
  { href: "/settings", label: "MENU", icon: Menu },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1e293b] border-t border-[#334155] lg:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                isActive 
                  ? "text-[#00b4ff]" 
                  : "text-[#64748b]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-wider">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
