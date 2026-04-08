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
  Globe, 
  Settings,
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
  { href: "/maps", label: "Maps", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
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
      <aside className="fixed left-0 top-0 z-40 h-screen w-[260px] bg-[#1e293b] border-r border-[#334155] flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#334155]">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00b4ff]/20">
            <Shield className="w-5 h-5 text-[#00b4ff]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">LogGuard</h1>
            <p className="text-xs text-[#94a3b8] tracking-wider">NETWORK OBSERVABILITY</p>
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
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-[#00b4ff]/10 text-[#00b4ff] border-l-4 border-[#00b4ff] -ml-1 pl-5" 
                    : "text-[#94a3b8] hover:bg-[#334155] hover:text-white"
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
          <div className="mx-4 mb-4 p-3 bg-[#0f172a] rounded-lg border border-[#334155]">
            <p className="text-xs text-[#94a3b8] mb-2">System Scan in Progress...</p>
            <div className="space-y-1.5">
              {microservices.map((service) => {
                const isChecked = scanResults.includes(service.name)
                return (
                  <div key={service.id} className="flex items-center gap-2 text-xs">
                    {isChecked ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#14b8a6]" />
                    ) : scanResults.length === microservices.indexOf(service) ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#00b4ff] animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-[#475569]" />
                    )}
                    <span className={cn(
                      isChecked ? "text-[#14b8a6]" : "text-[#64748b]"
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
            className="w-full bg-[#00b4ff]/10 hover:bg-[#00b4ff]/20 text-[#00b4ff] border border-[#00b4ff]/30 h-11"
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
        <div className="px-4 py-4 border-t border-[#334155]">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarImage src="/placeholder-user.jpg" alt="Admin" />
              <AvatarFallback className="bg-[#00b4ff]/20 text-[#00b4ff] text-sm">AR</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin_Root</p>
              <p className="text-xs text-[#64748b] truncate">System Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#14b8a6]/20 border border-[#14b8a6]/40 rounded-lg shadow-lg">
            <CheckCircle className="w-5 h-5 text-[#14b8a6]" />
            <div>
              <p className="text-sm font-medium text-[#14b8a6]">System Healthy</p>
              <p className="text-xs text-[#94a3b8]">All Microservices Operational</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
