"use client"

import { useState } from "react"
import { Search, Bell, HelpCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  searchPlaceholder?: string
  showTimeRange?: boolean
  showRefresh?: boolean
  onRefresh?: () => void
}

export function Header({ 
  searchPlaceholder = "Search logs, IPs, or threat signatures...",
  showTimeRange = true,
  showRefresh = false,
  onRefresh
}: HeaderProps) {
  const [timeRange, setTimeRange] = useState("Last 24 Hours")

  return (
    <header className="h-16 bg-[#0f172a] border-b border-[#334155] flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
        <Input 
          placeholder={searchPlaceholder}
          className="pl-10 bg-[#1e293b] border-[#334155] text-[#e2e8f0] placeholder:text-[#64748b] focus:border-[#00b4ff] focus:ring-[#00b4ff]/20 h-10"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {showTimeRange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-[#00b4ff] hover:bg-[#00b4ff]/90 text-[#0f172a] border-none font-medium h-9 px-4">
                Time Range
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1e293b] border-[#334155]">
              <DropdownMenuItem onClick={() => setTimeRange("Last 1 Hour")} className="text-[#e2e8f0] focus:bg-[#334155] focus:text-white">
                Last 1 Hour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("Last 24 Hours")} className="text-[#e2e8f0] focus:bg-[#334155] focus:text-white">
                Last 24 Hours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("Last 7 Days")} className="text-[#e2e8f0] focus:bg-[#334155] focus:text-white">
                Last 7 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange("Last 30 Days")} className="text-[#e2e8f0] focus:bg-[#334155] focus:text-white">
                Last 30 Days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <span className="text-sm text-[#94a3b8]">{timeRange}</span>

        {showRefresh && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#94a3b8] hover:text-white hover:bg-[#334155]"
            onClick={onRefresh}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}

        <Button variant="ghost" size="icon" className="text-[#94a3b8] hover:text-white hover:bg-[#334155] relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ef4444] rounded-full" />
        </Button>

        <Button variant="ghost" size="icon" className="text-[#94a3b8] hover:text-white hover:bg-[#334155]">
          <HelpCircle className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2 pl-3 border-l border-[#334155]">
          <div className="text-right">
            <p className="text-sm font-medium text-white">Admin</p>
            <p className="text-xs text-[#64748b]">System Root</p>
          </div>
          <Avatar className="w-9 h-9">
            <AvatarImage src="/placeholder-user.jpg" alt="Admin" />
            <AvatarFallback className="bg-[#f97316] text-white text-sm">A</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
