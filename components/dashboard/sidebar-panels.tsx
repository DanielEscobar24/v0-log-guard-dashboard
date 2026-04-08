"use client"

import { topAttackTypes, topSourceIPs } from "@/lib/mock-data"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TopAttackTypesPanel() {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        Top Attack Types
      </h3>
      <div className="space-y-4">
        {topAttackTypes.map((attack) => (
          <div key={attack.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-[#e2e8f0]">{attack.name}</span>
              <span className="text-sm text-[#94a3b8]">{attack.percentage}%</span>
            </div>
            <div className="h-1.5 bg-[#0f172a] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${attack.percentage}%`,
                  backgroundColor: attack.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopSourceIPsPanel() {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        Top Source IPs
      </h3>
      <div className="space-y-3">
        {topSourceIPs.map((ip) => (
          <div key={ip.ip} className="flex items-center justify-between">
            <span className="text-sm text-[#00b4ff] font-mono">{ip.ip}</span>
            <span className="text-xs text-[#14b8a6] bg-[#14b8a6]/10 px-2 py-0.5 rounded">
              {ip.flows} flows
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FiltersPanel() {
  const attackTypes = ['BENIGN', 'DDoS', 'PortScan', 'Bot', 'Brute Force']
  
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Filters
        </h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[#64748b] uppercase tracking-wider mb-2 block">
            Date Range
          </label>
          <Select defaultValue="24h">
            <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#e2e8f0]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e293b] border-[#334155]">
              <SelectItem value="1h" className="text-[#e2e8f0] focus:bg-[#334155]">Last 1 Hour</SelectItem>
              <SelectItem value="24h" className="text-[#e2e8f0] focus:bg-[#334155]">Last 24 Hours</SelectItem>
              <SelectItem value="7d" className="text-[#e2e8f0] focus:bg-[#334155]">Last 7 Days</SelectItem>
              <SelectItem value="30d" className="text-[#e2e8f0] focus:bg-[#334155]">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-xs text-[#64748b] uppercase tracking-wider mb-3 block">
            Attack Type
          </label>
          <div className="space-y-2.5">
            {attackTypes.map((type) => (
              <div key={type} className="flex items-center gap-2.5">
                <Checkbox 
                  id={type} 
                  defaultChecked={['BENIGN', 'DDoS', 'PortScan'].includes(type)}
                  className="border-[#475569] data-[state=checked]:bg-[#00b4ff] data-[state=checked]:border-[#00b4ff]"
                />
                <label htmlFor={type} className="text-sm text-[#e2e8f0] cursor-pointer">
                  {type}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <Button className="w-full bg-[#00b4ff]/10 hover:bg-[#00b4ff]/20 text-[#00b4ff] border border-[#00b4ff]/30">
          Apply Changes
        </Button>
      </div>
    </div>
  )
}
