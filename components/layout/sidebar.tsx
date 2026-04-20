"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  Shield,
  Zap,
  CheckCircle,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { microservices } from "@/lib/mock-data"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-logs", label: "Live Logs", icon: FileText },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
]

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [isScanning, setIsScanning] = useState(false)
  const [scanResults, setScanResults] = useState<string[]>([])
  const [showToast, setShowToast] = useState(false)

  const runDiagnostics = async () => {
    setIsScanning(true)
    setScanResults([])
    
    for (const service of microservices) {
      await new Promise(resolve => setTimeout(resolve, 600))
      setScanResults(prev => [...prev, service.name])
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsScanning(false)
    setShowToast(true)
    
    setTimeout(() => setShowToast(false), 4000)
  }

  return (
    <>
      <div className="h-full w-[260px] bg-sidebar text-sidebar-foreground flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-accent">
            <Shield className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">LogGuard</h1>
            <p className="text-xs text-muted-foreground tracking-wider">NETWORK OBSERVABILITY</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary -ml-1 pl-5"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Scan Results */}
        {isScanning && (
          <div className="mx-4 mb-4 p-3 bg-background/35 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">System Scan in Progress...</p>
            <div className="space-y-1.5">
              {microservices.map((service) => {
                const isChecked = scanResults.includes(service.name)
                return (
                  <div key={service.id} className="flex items-center gap-2 text-xs">
                    {isChecked ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : scanResults.length === microservices.indexOf(service) ? (
                      <Loader2 className="w-3.5 h-3.5 text-sidebar-primary animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border/50" />
                    )}
                    <span className={cn(
                      isChecked ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                      {service.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Run Diagnostics Button */}
        <div className="px-4 pb-4">
          <Button 
            onClick={runDiagnostics}
            disabled={isScanning}
            variant="outline"
            className="w-full h-11 bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-primary border-border/40"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>

        {/* User Profile */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src="/placeholder-user.jpg" alt="Admin" />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-primary text-sm">AR</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">Admin_Root</p>
              <p className="text-xs text-muted-foreground truncate">System Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-card/70 backdrop-blur-xl border border-border/40 rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-foreground">System Healthy</p>
              <p className="text-xs text-muted-foreground">All Microservices Operational</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[260px]">
      <SidebarContent />
    </aside>
  )
}
